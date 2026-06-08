namespace RealtimeMail;

public enum TrustCapability
{
    RenderHtml,
    RenderCss,
    RenderSvg,
    RunScriptSandboxed,
    OpenUrlUserGesture,
    PaymentRequestUserGesture,
    StorageIsolated,
    NetworkDomainOnly
}

public enum MailSource
{
    Traditional,
    Realtime
}

public enum TrustedDomainState
{
    Trusted,
    Muted,
    Revoked
}

public enum MessageLifecycleState
{
    Visible,
    Dismissed,
    Deleted,
    Superseded,
    Expired
}

public enum RealtimeMailActionType
{
    OpenUrl,
    PublishGatewayEvent,
    RequestNotification,
    StoreIsolatedValue
}

public sealed record RealtimeMailChannel(
    string Id,
    string Label,
    string Route,
    string? Description,
    IReadOnlyList<TrustCapability> Capabilities
);

public sealed record RealtimeMailManifest(
    string Protocol,
    string Version,
    string Domain,
    string DisplayName,
    IReadOnlyList<string> PublicKeys,
    IReadOnlyList<RealtimeMailChannel> Channels
);

public sealed record RealtimeMailMessage(
    string Id,
    MailSource Source,
    string Domain,
    string? ChannelId,
    string From,
    string Subject,
    string Html,
    string? Css,
    string? Script,
    IReadOnlyList<TrustCapability> Capabilities,
    DateTimeOffset ReceivedAt,
    DateTimeOffset? ExpiresAt,
    string? Signature
);

public sealed record TraditionalMailAccount(
    string Id,
    string Email,
    string Provider,
    string IncomingHost,
    string OutgoingHost
);

public sealed record RealtimeMailAction(
    string Id,
    string MessageId,
    string Domain,
    RealtimeMailActionType Type,
    bool RequiresUserGesture,
    string? Url,
    object? Payload
);
