using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RealtimeMail;

public sealed class SignatureVerifier
{
    public bool VerifyEd25519(RealtimeMailMessage message, string publicKey)
    {
        return false;
    }

    public bool VerifyEcdsaP256(RealtimeMailMessage message, string publicKey)
    {
        if (string.IsNullOrWhiteSpace(message.Signature) || !publicKey.StartsWith("ecdsa-p256:", StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            using var ecdsa = ECDsa.Create();
            var keyBytes = DecodeBase64Url(publicKey["ecdsa-p256:".Length..]);
            ecdsa.ImportSubjectPublicKeyInfo(keyBytes, out _);
            var signatureBytes = DecodeSignature(message.Signature);
            return ecdsa.VerifyData(Encoding.UTF8.GetBytes(CanonicalMessage(message)), signatureBytes, HashAlgorithmName.SHA256);
        }
        catch
        {
            return false;
        }
    }

    public string CanonicalMessage(RealtimeMailMessage message)
    {
        var values = new SortedDictionary<string, object?>
        {
            ["capabilities"] = message.Capabilities.Select(CapabilityValue).ToArray(),
            ["domain"] = message.Domain,
            ["from"] = message.From,
            ["html"] = message.Html,
            ["id"] = message.Id,
            ["receivedAt"] = message.ReceivedAt.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"),
            ["source"] = message.Source == MailSource.Realtime ? "realtime" : "traditional",
            ["subject"] = message.Subject
        };

        if (!string.IsNullOrEmpty(message.ChannelId)) values["channelId"] = message.ChannelId;
        if (!string.IsNullOrEmpty(message.Css)) values["css"] = message.Css;
        if (message.ExpiresAt is not null) values["expiresAt"] = message.ExpiresAt.Value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
        if (!string.IsNullOrEmpty(message.Script)) values["script"] = message.Script;

        return JsonSerializer.Serialize(values, RealtimeMailJson.Options);
    }

    private static string CapabilityValue(TrustCapability capability)
    {
        return capability switch
        {
            TrustCapability.RenderHtml => "render:html",
            TrustCapability.RenderCss => "render:css",
            TrustCapability.RenderSvg => "render:svg",
            TrustCapability.RunScriptSandboxed => "run:script-sandboxed",
            TrustCapability.OpenUrlUserGesture => "open-url:user-gesture",
            TrustCapability.PaymentRequestUserGesture => "payment-request:user-gesture",
            TrustCapability.StorageIsolated => "storage:isolated",
            TrustCapability.NetworkDomainOnly => "network:domain-only",
            _ => throw new ArgumentOutOfRangeException(nameof(capability), capability, null)
        };
    }

    private static byte[] DecodeSignature(string signature)
    {
        var value = signature.StartsWith("rmail1.", StringComparison.Ordinal)
            ? signature.Split('.')[2]
            : signature.Replace("ed25519:", "", StringComparison.Ordinal);
        return DecodeBase64Url(value);
    }

    private static byte[] DecodeBase64Url(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight((int)Math.Ceiling(padded.Length / 4d) * 4, '=');
        return Convert.FromBase64String(padded);
    }
}
