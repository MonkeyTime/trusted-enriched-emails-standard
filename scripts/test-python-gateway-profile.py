from __future__ import annotations

import base64
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "python" / "src"))

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except Exception:
    print("SKIP Python gateway profile: cryptography package not installed")
    raise SystemExit(0)

from realtime_mail import (  # noqa: E402
    ActionReceiver,
    HostActionBroker,
    MessageSigner,
    RealtimeMailActionType,
    RealtimeMailChannel,
    RealtimeMailManifest,
    RealtimeMessageBuilder,
    RouteAuthorizer,
    DomainStateSnapshot,
    MessageLifecycleState,
    MessageStateSnapshot,
    StatePolicy,
    TrustedDomainState,
    TrustCapability,
    TrustPolicy,
)


def main() -> int:
    private_key = Ed25519PrivateKey.generate()
    public_key = "ed25519:" + base64.urlsafe_b64encode(private_key.public_key().public_bytes_raw()).decode("ascii").rstrip("=")
    manifest = RealtimeMailManifest(
        protocol="realtime-mail",
        version="0.1-draft",
        domain="billing.acme.tld",
        display_name="ACME Billing",
        public_keys=[public_key],
        channels=[
            RealtimeMailChannel(
                id="invoice-events",
                label="Invoices",
                route="/rt/invoices/:userId",
                capabilities=[
                    TrustCapability.RENDER_HTML,
                    TrustCapability.RENDER_CSS,
                    TrustCapability.OPEN_URL_USER_GESTURE,
                ],
            )
        ],
    )
    builder = RealtimeMessageBuilder(manifest, clock=lambda timezone_arg: datetime(2026, 6, 8, 8, 0, tzinfo=timezone.utc))
    message = builder.build(
        id="host-action-001",
        channel_id="invoice-events",
        from_address="billing@acme.tld",
        subject="Action test",
        html="<a>Open</a>",
        expires_at=datetime(2026, 6, 8, 8, 15, tzinfo=timezone.utc),
    )
    message = MessageSigner().sign_ed25519(message, private_key)
    action = {
        "id": "open-invoice",
        "messageId": message.id,
        "domain": message.domain,
        "type": RealtimeMailActionType.OPEN_URL.value,
        "requiresUserGesture": True,
        "url": "https://billing.acme.tld/invoices/1",
    }
    trust = TrustPolicy()
    trust.trust_domain("billing.acme.tld")
    broker = HostActionBroker(trust)
    assert broker.authorize(action, message, manifest, True, datetime(2026, 6, 8, 8, 1, tzinfo=timezone.utc))[0]
    assert not broker.authorize(action, message, manifest, False, datetime(2026, 6, 8, 8, 1, tzinfo=timezone.utc))[0]
    assert not broker.authorize(action, message, manifest, True, datetime(2026, 6, 8, 8, 16, tzinfo=timezone.utc))[0]
    assert RouteAuthorizer(manifest).authorize("/rt/invoices/demo-user", "invoice-events", "demo-user")[0]
    assert not RouteAuthorizer(manifest).authorize("/rt/admin/demo-user", "invoice-events", "demo-user")[0]
    assert ActionReceiver("billing.acme.tld").receive(action)[0]
    cross_domain = {**action, "domain": "evil.example", "url": "https://evil.example/invoices/1"}
    assert not ActionReceiver("billing.acme.tld").receive(cross_domain)[0]
    assert StatePolicy.evaluate_domain_state("billing.acme.tld", DomainStateSnapshot(trusted_domains={"billing.acme.tld"})) == TrustedDomainState.TRUSTED
    assert StatePolicy.evaluate_domain_state("billing.acme.tld", DomainStateSnapshot(trusted_domains={"billing.acme.tld"}, muted_domains={"billing.acme.tld"})) == TrustedDomainState.MUTED
    assert StatePolicy.evaluate_domain_state("billing.acme.tld", DomainStateSnapshot(trusted_domains={"billing.acme.tld"}, revoked_domains={"billing.acme.tld"})) == TrustedDomainState.REVOKED
    assert StatePolicy.evaluate_message_state(message, MessageStateSnapshot(now=datetime(2026, 6, 8, 8, 16, tzinfo=timezone.utc))) == MessageLifecycleState.EXPIRED
    assert StatePolicy.evaluate_message_state(
        message,
        MessageStateSnapshot(
            deleted_message_ids={message.id},
            dismissed_message_ids={message.id},
            now=datetime(2026, 6, 8, 8, 16, tzinfo=timezone.utc),
        ),
    ) == MessageLifecycleState.DELETED
    print("PASS Python gateway profile security gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
