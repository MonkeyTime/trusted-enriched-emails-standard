package org.realtimemail;

import java.time.Instant;

public final class StatePolicy {
  public TrustedDomainState evaluateDomainState(String domain, DomainStateSnapshot snapshot) {
    if (snapshot.revokedDomains().contains(domain)) return TrustedDomainState.REVOKED;
    if (snapshot.mutedDomains().contains(domain)) return TrustedDomainState.MUTED;
    return snapshot.trustedDomains().contains(domain) ? TrustedDomainState.TRUSTED : TrustedDomainState.REVOKED;
  }

  public MessageLifecycleState evaluateMessageState(RealtimeMailMessage message, MessageStateSnapshot snapshot) {
    if (snapshot.deletedMessageIds().contains(message.id())) return MessageLifecycleState.DELETED;
    if (snapshot.supersededMessageIds().contains(message.id())) return MessageLifecycleState.SUPERSEDED;
    var now = snapshot.now().orElseGet(Instant::now);
    if (message.expiresAt().isPresent() && !message.expiresAt().get().isAfter(now)) return MessageLifecycleState.EXPIRED;
    if (snapshot.dismissedMessageIds().contains(message.id())) return MessageLifecycleState.DISMISSED;
    return MessageLifecycleState.VISIBLE;
  }

  public boolean shouldDisplay(RealtimeMailMessage message, DomainStateSnapshot domainSnapshot, MessageStateSnapshot messageSnapshot) {
    return evaluateDomainState(message.domain(), domainSnapshot) == TrustedDomainState.TRUSTED
      && evaluateMessageState(message, messageSnapshot) == MessageLifecycleState.VISIBLE;
  }
}
