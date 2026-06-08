using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RealtimeMail;

public sealed record HostActionDecision(bool Ok, string Reason, RealtimeMailAction? Action = null);
public sealed record RouteAuthorizationDecision(bool Ok, string Reason, RealtimeMailChannel? Channel = null);
public sealed record GatewayActionDecision(bool Ok, string Reason, RealtimeMailAction? Action = null);
public sealed record PaymentRequestSecurityDecision(bool Ok, string Reason, IReadOnlyDictionary<string, object?>? Payload = null);

public sealed class HostActionBroker
{
    private readonly TrustPolicy trustPolicy;
    private readonly SignatureVerifier verifier;

    public HostActionBroker(TrustPolicy trustPolicy, SignatureVerifier? verifier = null)
    {
        this.trustPolicy = trustPolicy;
        this.verifier = verifier ?? new SignatureVerifier();
    }

    public HostActionDecision Authorize(RealtimeMailAction action, RealtimeMailMessage message, RealtimeMailManifest manifest, bool userGesture, DateTimeOffset? now = null)
    {
        if (new ActionValidator().Validate(action).Count > 0) return new HostActionDecision(false, "invalid_action");
        if (action.MessageId != message.Id) return new HostActionDecision(false, "message_mismatch");
        if (action.Domain != message.Domain || action.Domain != manifest.Domain) return new HostActionDecision(false, "domain_mismatch");
        if (!trustPolicy.IsTrusted(action.Domain)) return new HostActionDecision(false, "domain_not_trusted");
        if (!userGesture || !action.RequiresUserGesture) return new HostActionDecision(false, "user_gesture_required");
        if (message.ExpiresAt is not null && message.ExpiresAt <= (now ?? DateTimeOffset.UtcNow)) return new HostActionDecision(false, "message_expired");
        if (!manifest.PublicKeys.Any(key => key.StartsWith("ecdsa-p256:", StringComparison.Ordinal) && verifier.VerifyEcdsaP256(message, key)))
        {
            return new HostActionDecision(false, "signature_required");
        }
        if (action.Type == RealtimeMailActionType.OpenUrl && !message.Capabilities.Contains(TrustCapability.OpenUrlUserGesture))
        {
            return new HostActionDecision(false, "capability_required");
        }
        if (IsPaymentRequest(action.Payload) && !message.Capabilities.Contains(TrustCapability.PaymentRequestUserGesture))
        {
            return new HostActionDecision(false, "capability_required");
        }
        return new HostActionDecision(true, "ok", action);
    }

    private static bool IsPaymentRequest(object? payload)
    {
        if (payload is null) return false;
        if (payload is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            return element.TryGetProperty("kind", out var kind)
                && kind.GetString() == "host-mediated-payment-request";
        }
        if (payload is IReadOnlyDictionary<string, object?> dictionary)
        {
            return dictionary.TryGetValue("kind", out var kind)
                && string.Equals(kind?.ToString(), "host-mediated-payment-request", StringComparison.Ordinal);
        }
        return false;
    }
}

public sealed class RealtimeMessageBuilder
{
    private readonly RealtimeMailManifest manifest;
    private readonly Func<DateTimeOffset> clock;

    public RealtimeMessageBuilder(RealtimeMailManifest manifest, Func<DateTimeOffset>? clock = null)
    {
        this.manifest = manifest;
        this.clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public RealtimeMailMessage Build(
        string channelId,
        string from,
        string subject,
        string html,
        string? css = null,
        string? script = null,
        IReadOnlyList<TrustCapability>? capabilities = null,
        DateTimeOffset? expiresAt = null,
        string? id = null)
    {
        var channel = manifest.Channels.FirstOrDefault(candidate => candidate.Id == channelId)
            ?? throw new ArgumentException($"Unknown channel: {channelId}", nameof(channelId));
        var message = new RealtimeMailMessage(
            id ?? Guid.NewGuid().ToString(),
            MailSource.Realtime,
            manifest.Domain,
            channel.Id,
            from,
            subject,
            html,
            css,
            script,
            capabilities ?? channel.Capabilities,
            clock(),
            expiresAt,
            null
        );
        var issues = new MessageValidator().Validate(message with { Signature = "unsigned-builder-placeholder" });
        if (issues.Count > 0) throw new RealtimeMailValidationException(issues);
        return message;
    }
}

public sealed class MessageSigner
{
    private readonly SignatureVerifier verifier;

    public MessageSigner(SignatureVerifier? verifier = null)
    {
        this.verifier = verifier ?? new SignatureVerifier();
    }

    public RealtimeMailMessage SignEcdsaP256(RealtimeMailMessage message, ECDsa privateKey)
    {
        var unsigned = message with { Signature = null };
        var signature = privateKey.SignData(Encoding.UTF8.GetBytes(verifier.CanonicalMessage(unsigned)), HashAlgorithmName.SHA256);
        return unsigned with { Signature = "rmail1.eyJhbGciOiJFUzI1NiIsInR5cCI6InJtYWlsMSJ9." + Base64Url(signature) };
    }

    private static string Base64Url(byte[] value)
    {
        return Convert.ToBase64String(value).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}

public sealed class RouteAuthorizer
{
    private readonly RealtimeMailManifest manifest;

    public RouteAuthorizer(RealtimeMailManifest manifest)
    {
        this.manifest = manifest;
    }

    public RouteAuthorizationDecision Authorize(string route, string? channelId = null, string? userId = null)
    {
        foreach (var channel in manifest.Channels)
        {
            if (channelId is not null && channel.Id != channelId) continue;
            if (RouteMatches(channel.Route, route, userId)) return new RouteAuthorizationDecision(true, "ok", channel);
        }
        return new RouteAuthorizationDecision(false, "route_not_allowed");
    }

    private static bool RouteMatches(string pattern, string route, string? userId)
    {
        var patternParts = pattern.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var routeParts = route.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (patternParts.Length != routeParts.Length) return false;
        for (var index = 0; index < patternParts.Length; index++)
        {
            if (patternParts[index] == ":userId")
            {
                if (userId is null || routeParts[index] != userId) return false;
            }
            else if (patternParts[index].StartsWith(':') || patternParts[index] != routeParts[index])
            {
                return false;
            }
        }
        return true;
    }
}

public sealed class ActionReceiver
{
    private readonly string domain;

    public ActionReceiver(string domain)
    {
        this.domain = domain;
    }

    public GatewayActionDecision Receive(RealtimeMailAction action)
    {
        if (new ActionValidator().Validate(action).Count > 0) return new GatewayActionDecision(false, "invalid_action");
        if (!string.Equals(action.Domain, domain, StringComparison.OrdinalIgnoreCase)) return new GatewayActionDecision(false, "domain_not_allowed");
        return new GatewayActionDecision(true, "ok", action);
    }
}

public sealed class PaymentRequestSecurityPolicy
{
    public PaymentRequestSecurityDecision Authorize(
        RealtimeMailAction action,
        RealtimeMailMessage message,
        RealtimeMailManifest manifest,
        bool sourceMatchesSelectedSandbox,
        string? expectedInvoiceId = null,
        string? expectedAmount = null,
        string? expectedCurrency = null,
        IReadOnlySet<string>? processedInvoiceIds = null,
        DateTimeOffset? now = null)
    {
        if (!sourceMatchesSelectedSandbox) return Rejected("untrusted_frame_source");
        if (action.Type != RealtimeMailActionType.PublishGatewayEvent || !PaymentRequestHelpers.TryGetPayload(action.Payload, out var payload)) return Rejected("payment_payload_required");
        if (new PaymentRequestPayloadValidator().Validate(payload).Count > 0) return Rejected("invalid_payment_payload");
        if (action.MessageId != message.Id) return Rejected("message_mismatch");
        if (action.Domain != message.Domain || action.Domain != manifest.Domain) return Rejected("domain_mismatch");
        if (!PaymentRequestHelpers.TryGetObject(payload, "merchant", out var merchant) || PaymentRequestHelpers.GetString(merchant, "domain") != message.Domain) return Rejected("merchant_domain_mismatch");
        if (!message.Capabilities.Contains(TrustCapability.PaymentRequestUserGesture)) return Rejected("capability_required");
        if (expectedInvoiceId is not null && PaymentRequestHelpers.GetString(payload, "invoiceId") != expectedInvoiceId) return Rejected("invoice_mismatch");
        PaymentRequestHelpers.TryGetObject(payload, "amount", out var amount);
        if (expectedAmount is not null && PaymentRequestHelpers.GetString(amount, "value") != expectedAmount) return Rejected("amount_mismatch");
        if (expectedCurrency is not null && PaymentRequestHelpers.GetString(amount, "currency") != expectedCurrency) return Rejected("currency_mismatch");
        if (!DateTimeOffset.TryParse(PaymentRequestHelpers.GetString(payload, "expiresAt"), out var expiresAt) || expiresAt <= (now ?? DateTimeOffset.UtcNow)) return Rejected("payment_expired");
        if ((processedInvoiceIds ?? new HashSet<string>()).Contains(PaymentRequestHelpers.GetString(payload, "invoiceId") ?? "")) return Rejected("duplicate_invoice");
        return new PaymentRequestSecurityDecision(true, "ok", payload);
    }

    private static PaymentRequestSecurityDecision Rejected(string reason) => new(false, reason);
}
