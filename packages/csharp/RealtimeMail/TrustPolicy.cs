namespace RealtimeMail;

public sealed class TrustPolicy
{
    private readonly HashSet<string> trustedDomains = new(StringComparer.OrdinalIgnoreCase);

    public void TrustDomain(string domain)
    {
        trustedDomains.Add(domain);
    }

    public void RevokeDomain(string domain)
    {
        trustedDomains.Remove(domain);
    }

    public bool IsTrusted(string domain)
    {
        return trustedDomains.Contains(domain);
    }

    public bool CanRender(RealtimeMailMessage message)
    {
        if (message.Source == MailSource.Traditional)
        {
            return message.Capabilities.Contains(TrustCapability.RenderHtml);
        }

        return IsTrusted(message.Domain) && message.Capabilities.Contains(TrustCapability.RenderHtml);
    }

    public bool CanRunScript(RealtimeMailMessage message)
    {
        return message.Source == MailSource.Realtime
            && IsTrusted(message.Domain)
            && message.Capabilities.Contains(TrustCapability.RunScriptSandboxed);
    }
}
