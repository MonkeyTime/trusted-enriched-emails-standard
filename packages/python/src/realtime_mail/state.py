from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from .models import MessageLifecycleState, RealtimeMailMessage, TrustedDomainState


@dataclass(frozen=True)
class DomainStateSnapshot:
    trusted_domains: set[str] = field(default_factory=set)
    muted_domains: set[str] = field(default_factory=set)
    revoked_domains: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class MessageStateSnapshot:
    dismissed_message_ids: set[str] = field(default_factory=set)
    deleted_message_ids: set[str] = field(default_factory=set)
    superseded_message_ids: set[str] = field(default_factory=set)
    now: datetime | None = None


class StatePolicy:
    @staticmethod
    def evaluate_domain_state(domain: str, snapshot: DomainStateSnapshot) -> TrustedDomainState:
        if domain in snapshot.revoked_domains:
            return TrustedDomainState.REVOKED
        if domain in snapshot.muted_domains:
            return TrustedDomainState.MUTED
        if domain in snapshot.trusted_domains:
            return TrustedDomainState.TRUSTED
        return TrustedDomainState.REVOKED

    @staticmethod
    def evaluate_message_state(message: RealtimeMailMessage, snapshot: MessageStateSnapshot | None = None) -> MessageLifecycleState:
        snapshot = snapshot or MessageStateSnapshot()
        if message.id in snapshot.deleted_message_ids:
            return MessageLifecycleState.DELETED
        if message.id in snapshot.superseded_message_ids:
            return MessageLifecycleState.SUPERSEDED
        now = snapshot.now or datetime.now(timezone.utc)
        if message.expires_at and message.expires_at <= now:
            return MessageLifecycleState.EXPIRED
        if message.id in snapshot.dismissed_message_ids:
            return MessageLifecycleState.DISMISSED
        return MessageLifecycleState.VISIBLE

    @staticmethod
    def should_display(
        message: RealtimeMailMessage,
        domain_snapshot: DomainStateSnapshot,
        message_snapshot: MessageStateSnapshot | None = None,
    ) -> bool:
        return (
            StatePolicy.evaluate_domain_state(message.domain, domain_snapshot) == TrustedDomainState.TRUSTED
            and StatePolicy.evaluate_message_state(message, message_snapshot) == MessageLifecycleState.VISIBLE
        )
