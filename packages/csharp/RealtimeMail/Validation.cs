namespace RealtimeMail;

public sealed record ValidationIssue(string Path, string Message);

public sealed class RealtimeMailValidationException : Exception
{
    public RealtimeMailValidationException(IReadOnlyList<ValidationIssue> issues)
        : base(string.Join("; ", issues.Select(issue => $"{issue.Path}: {issue.Message}")))
    {
        Issues = issues;
    }

    public IReadOnlyList<ValidationIssue> Issues { get; }
}

public sealed class ManifestValidator
{
    public IReadOnlyList<ValidationIssue> Validate(RealtimeMailManifest manifest)
    {
        var issues = new List<ValidationIssue>();
        if (manifest.Protocol != "realtime-mail")
        {
            issues.Add(new ValidationIssue("$.protocol", "must equal realtime-mail"));
        }
        if (string.IsNullOrWhiteSpace(manifest.Version))
        {
            issues.Add(new ValidationIssue("$.version", "must be set"));
        }
        if (!IsDomain(manifest.Domain))
        {
            issues.Add(new ValidationIssue("$.domain", "must be a valid domain"));
        }
        if (string.IsNullOrWhiteSpace(manifest.DisplayName))
        {
            issues.Add(new ValidationIssue("$.displayName", "must be set"));
        }
        if (manifest.PublicKeys is null || manifest.PublicKeys.Count == 0)
        {
            issues.Add(new ValidationIssue("$.publicKeys", "must be non-empty"));
        }
        if (manifest.Channels is null || manifest.Channels.Count == 0)
        {
            issues.Add(new ValidationIssue("$.channels", "must be non-empty"));
        }
        return issues;
    }

    public RealtimeMailManifest Parse(RealtimeMailManifest manifest)
    {
        var issues = Validate(manifest);
        if (issues.Count > 0)
        {
            throw new RealtimeMailValidationException(issues);
        }
        return manifest;
    }

    private static bool IsDomain(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Contains('.') && value.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '-' or '.');
    }
}

public sealed class MessageValidator
{
    public IReadOnlyList<ValidationIssue> Validate(RealtimeMailMessage message)
    {
        var issues = new List<ValidationIssue>();
        if (string.IsNullOrWhiteSpace(message.Id)) issues.Add(new ValidationIssue("$.id", "must be set"));
        if (string.IsNullOrWhiteSpace(message.Domain)) issues.Add(new ValidationIssue("$.domain", "must be set"));
        if (string.IsNullOrWhiteSpace(message.From)) issues.Add(new ValidationIssue("$.from", "must be set"));
        if (string.IsNullOrWhiteSpace(message.Html)) issues.Add(new ValidationIssue("$.html", "must be set"));
        if (message.Source == MailSource.Realtime && string.IsNullOrWhiteSpace(message.ChannelId))
        {
            issues.Add(new ValidationIssue("$.channelId", "is required for realtime messages"));
        }
        if (message.Source == MailSource.Realtime && string.IsNullOrWhiteSpace(message.Signature))
        {
            issues.Add(new ValidationIssue("$.signature", "is required for realtime messages"));
        }
        if (message.Capabilities is null || message.Capabilities.Count == 0)
        {
            issues.Add(new ValidationIssue("$.capabilities", "must be set"));
        }
        if (!string.IsNullOrEmpty(message.Script) && message.Capabilities is not null && !message.Capabilities.Contains(TrustCapability.RunScriptSandboxed))
        {
            issues.Add(new ValidationIssue("$.capabilities", "must include RunScriptSandboxed when script is present"));
        }
        return issues;
    }

    public RealtimeMailMessage Parse(RealtimeMailMessage message)
    {
        var issues = Validate(message);
        if (issues.Count > 0)
        {
            throw new RealtimeMailValidationException(issues);
        }
        return message;
    }
}

public sealed class ActionValidator
{
    public IReadOnlyList<ValidationIssue> Validate(RealtimeMailAction action)
    {
        var issues = new List<ValidationIssue>();
        if (string.IsNullOrWhiteSpace(action.Id)) issues.Add(new ValidationIssue("$.id", "must be set"));
        if (string.IsNullOrWhiteSpace(action.MessageId)) issues.Add(new ValidationIssue("$.messageId", "must be set"));
        if (!IsDomain(action.Domain)) issues.Add(new ValidationIssue("$.domain", "must be a valid domain"));
        if (!action.RequiresUserGesture) issues.Add(new ValidationIssue("$.requiresUserGesture", "must be true"));
        if (action.Type == RealtimeMailActionType.OpenUrl && !IsHttpsUrlForDomain(action.Url, action.Domain))
        {
            issues.Add(new ValidationIssue("$.url", "must be an https URL for the action domain"));
        }
        if (PaymentRequestHelpers.TryGetPayload(action.Payload, out var payload))
        {
            issues.AddRange(new PaymentRequestPayloadValidator().Validate(payload).Select(issue => new ValidationIssue("$.payload" + issue.Path[1..], issue.Message)));
            if (action.Type != RealtimeMailActionType.PublishGatewayEvent)
            {
                issues.Add(new ValidationIssue("$.type", "must be publish_gateway_event for payment requests"));
            }
            if (PaymentRequestHelpers.TryGetObject(payload, "merchant", out var merchant)
                && PaymentRequestHelpers.GetString(merchant, "domain") != action.Domain)
            {
                issues.Add(new ValidationIssue("$.payload.merchant.domain", "must match action domain"));
            }
        }
        return issues;
    }

    public RealtimeMailAction Parse(RealtimeMailAction action)
    {
        var issues = Validate(action);
        if (issues.Count > 0)
        {
            throw new RealtimeMailValidationException(issues);
        }
        return action;
    }

    private static bool IsDomain(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Contains('.') && value.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '-' or '.');
    }

    private static bool IsHttpsUrlForDomain(string? value, string domain)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && string.Equals(uri.Host, domain, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class PaymentRequestPayloadValidator
{
    public IReadOnlyList<ValidationIssue> Validate(IReadOnlyDictionary<string, object?> payload)
    {
        var issues = new List<ValidationIssue>();
        if (PaymentRequestHelpers.GetString(payload, "kind") != "host-mediated-payment-request") issues.Add(new ValidationIssue("$.kind", "must equal host-mediated-payment-request"));
        if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(payload, "invoiceId"))) issues.Add(new ValidationIssue("$.invoiceId", "must be a string"));
        if (!PaymentRequestHelpers.TryGetObject(payload, "merchant", out var merchant))
        {
            issues.Add(new ValidationIssue("$.merchant", "must be an object"));
        }
        else
        {
            if (!IsDomain(PaymentRequestHelpers.GetString(merchant, "domain") ?? "")) issues.Add(new ValidationIssue("$.merchant.domain", "must be a valid domain"));
            if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(merchant, "displayName"))) issues.Add(new ValidationIssue("$.merchant.displayName", "must be a string"));
        }
        if (!PaymentRequestHelpers.TryGetObject(payload, "amount", out var amount))
        {
            issues.Add(new ValidationIssue("$.amount", "must be an object"));
        }
        else
        {
            if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(amount, "value"))) issues.Add(new ValidationIssue("$.amount.value", "must be a string"));
            if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(amount, "currency"))) issues.Add(new ValidationIssue("$.amount.currency", "must be a string"));
        }
        if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(payload, "description"))) issues.Add(new ValidationIssue("$.description", "must be a string"));
        if (!new[] { "browser_payment_request", "host_confirmation", "provider_checkout", "qr_code" }.Contains(PaymentRequestHelpers.GetString(payload, "confirmationUx")))
        {
            issues.Add(new ValidationIssue("$.confirmationUx", "must be a supported confirmation UX"));
        }
        if (PaymentRequestHelpers.TryGetObject(payload, "fallbackProvider", out var fallback))
        {
            if (!new[] { "provider_checkout", "qr_code" }.Contains(PaymentRequestHelpers.GetString(fallback, "type")))
            {
                issues.Add(new ValidationIssue("$.fallbackProvider.type", "must be a supported fallback provider type"));
            }
            if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(fallback, "label"))) issues.Add(new ValidationIssue("$.fallbackProvider.label", "must be a string"));
            var merchantDomain = merchant is null ? null : PaymentRequestHelpers.GetString(merchant, "domain");
            if (!string.IsNullOrWhiteSpace(merchantDomain))
            {
                ValidateFallbackDomain(PaymentRequestHelpers.GetString(fallback, "url"), merchantDomain, "$.fallbackProvider.url", issues);
                ValidateFallbackDomain(PaymentRequestHelpers.GetString(fallback, "qrPayload"), merchantDomain, "$.fallbackProvider.qrPayload", issues);
            }
        }
        if (string.IsNullOrWhiteSpace(PaymentRequestHelpers.GetString(payload, "expiresAt"))) issues.Add(new ValidationIssue("$.expiresAt", "must be a string"));
        return issues;
    }

    private static bool IsDomain(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Contains('.') && value.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '-' or '.');
    }

    private static void ValidateFallbackDomain(string? value, string merchantDomain, string path, List<ValidationIssue> issues)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.StartsWith("https://", StringComparison.Ordinal)) return;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !string.Equals(uri.Host, merchantDomain, StringComparison.OrdinalIgnoreCase))
        {
            issues.Add(new ValidationIssue(path, "must stay on the merchant domain"));
        }
    }
}

internal static class PaymentRequestHelpers
{
    public static bool TryGetPayload(object? payload, out IReadOnlyDictionary<string, object?> value)
    {
        if (payload is IReadOnlyDictionary<string, object?> dictionary && GetString(dictionary, "kind") == "host-mediated-payment-request")
        {
            value = dictionary;
            return true;
        }
        value = new Dictionary<string, object?>();
        return false;
    }

    public static bool TryGetObject(IReadOnlyDictionary<string, object?> payload, string key, out IReadOnlyDictionary<string, object?> value)
    {
        if (payload.TryGetValue(key, out var raw) && raw is IReadOnlyDictionary<string, object?> dictionary)
        {
            value = dictionary;
            return true;
        }
        value = new Dictionary<string, object?>();
        return false;
    }

    public static string? GetString(IReadOnlyDictionary<string, object?> payload, string key)
    {
        return payload.TryGetValue(key, out var raw) ? raw?.ToString() : null;
    }
}
