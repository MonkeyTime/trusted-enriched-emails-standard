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
