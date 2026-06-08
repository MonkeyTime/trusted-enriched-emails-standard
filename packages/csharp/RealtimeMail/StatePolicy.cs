namespace RealtimeMail;

public sealed record DomainStateSnapshot(
    IReadOnlySet<string> TrustedDomains,
    IReadOnlySet<string> MutedDomains,
    IReadOnlySet<string> RevokedDomains
);

public sealed record MessageStateSnapshot(
    IReadOnlySet<string> DismissedMessageIds,
    IReadOnlySet<string> DeletedMessageIds,
    IReadOnlySet<string> SupersededMessageIds,
    DateTimeOffset? Now = null
);

public sealed class StatePolicy
{
    public TrustedDomainState EvaluateDomainState(string domain, DomainStateSnapshot snapshot)
    {
        if (snapshot.RevokedDomains.Contains(domain)) return TrustedDomainState.Revoked;
        if (snapshot.MutedDomains.Contains(domain)) return TrustedDomainState.Muted;
        return snapshot.TrustedDomains.Contains(domain) ? TrustedDomainState.Trusted : TrustedDomainState.Revoked;
    }

    public MessageLifecycleState EvaluateMessageState(RealtimeMailMessage message, MessageStateSnapshot snapshot)
    {
        if (snapshot.DeletedMessageIds.Contains(message.Id)) return MessageLifecycleState.Deleted;
        if (snapshot.SupersededMessageIds.Contains(message.Id)) return MessageLifecycleState.Superseded;
        if (message.ExpiresAt is not null && message.ExpiresAt <= (snapshot.Now ?? DateTimeOffset.UtcNow)) return MessageLifecycleState.Expired;
        if (snapshot.DismissedMessageIds.Contains(message.Id)) return MessageLifecycleState.Dismissed;
        return MessageLifecycleState.Visible;
    }

    public bool ShouldDisplay(RealtimeMailMessage message, DomainStateSnapshot domainSnapshot, MessageStateSnapshot messageSnapshot)
    {
        return EvaluateDomainState(message.Domain, domainSnapshot) == TrustedDomainState.Trusted
            && EvaluateMessageState(message, messageSnapshot) == MessageLifecycleState.Visible;
    }
}
