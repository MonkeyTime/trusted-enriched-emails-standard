from __future__ import annotations

from .models import MailSource, RealtimeMailMessage, TrustCapability


class TrustPolicy:
    def __init__(self) -> None:
        self._trusted_domains: set[str] = set()

    def trust_domain(self, domain: str) -> None:
        self._trusted_domains.add(domain)

    def revoke_domain(self, domain: str) -> None:
        self._trusted_domains.discard(domain)

    def is_trusted(self, domain: str) -> bool:
        return domain in self._trusted_domains

    def can_render(self, message: RealtimeMailMessage) -> bool:
        if message.source == MailSource.TRADITIONAL:
            return TrustCapability.RENDER_HTML in message.capabilities
        return self.is_trusted(message.domain) and TrustCapability.RENDER_HTML in message.capabilities

    def can_run_script(self, message: RealtimeMailMessage) -> bool:
        return (
            message.source == MailSource.REALTIME
            and self.is_trusted(message.domain)
            and TrustCapability.RUN_SCRIPT_SANDBOXED in message.capabilities
        )
