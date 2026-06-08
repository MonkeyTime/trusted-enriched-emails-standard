from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .models import MailSource, RealtimeMailAction, RealtimeMailManifest, RealtimeMailMessage, TrustCapability, action_from_dict
from .signature import SignatureVerifier
from .trust import TrustPolicy
from .validation import ActionValidator, ValidationError, ValidationIssue, MessageValidator


class HostActionBroker:
    def __init__(self, trust_policy: TrustPolicy, verifier: SignatureVerifier | None = None) -> None:
        self.trust_policy = trust_policy
        self.verifier = verifier or SignatureVerifier()

    def authorize(
        self,
        action_value: Any,
        message: RealtimeMailMessage,
        manifest: RealtimeMailManifest,
        user_gesture: bool,
        now: datetime | None = None,
    ) -> tuple[bool, str, RealtimeMailAction | None]:
        issues = ActionValidator.validate(action_value)
        if issues:
            return False, "invalid_action", None
        action = action_from_dict(action_value)
        if action.message_id != message.id:
            return False, "message_mismatch", None
        if action.domain != message.domain or action.domain != manifest.domain:
            return False, "domain_mismatch", None
        if not self.trust_policy.is_trusted(action.domain):
            return False, "domain_not_trusted", None
        if not user_gesture or not action.requires_user_gesture:
            return False, "user_gesture_required", None
        if message.expires_at and message.expires_at <= (now or datetime.now(timezone.utc)):
            return False, "message_expired", None
        if not any(key.startswith("ed25519:") and self.verifier.verify_ed25519(message, key) for key in manifest.public_keys):
            return False, "signature_required", None
        if action.type.value == "open_url" and TrustCapability.OPEN_URL_USER_GESTURE not in message.capabilities:
            return False, "capability_required", None
        if _is_payment_request(action.payload) and TrustCapability.PAYMENT_REQUEST_USER_GESTURE not in message.capabilities:
            return False, "capability_required", None
        return True, "ok", action


class RealtimeMessageBuilder:
    def __init__(self, manifest: RealtimeMailManifest, clock=datetime.now) -> None:
        self.manifest = manifest
        self.clock = clock

    def build(
        self,
        *,
        channel_id: str,
        from_address: str,
        subject: str,
        html: str,
        css: str | None = None,
        script: str | None = None,
        capabilities: list[TrustCapability] | None = None,
        expires_at: datetime | None = None,
        id: str | None = None,
    ) -> RealtimeMailMessage:
        channel = next((candidate for candidate in self.manifest.channels if candidate.id == channel_id), None)
        if channel is None:
            raise ValueError(f"Unknown channel: {channel_id}")
        message = RealtimeMailMessage(
            id=id or str(uuid4()),
            source=MailSource.REALTIME,
            domain=self.manifest.domain,
            channel_id=channel.id,
            from_address=from_address,
            subject=subject,
            html=html,
            css=css,
            script=script,
            capabilities=capabilities or channel.capabilities,
            received_at=self.clock(timezone.utc),
            expires_at=expires_at,
        )
        issues = MessageValidator.validate({**_message_to_wire(message), "signature": "unsigned-builder-placeholder"})
        if issues:
            raise ValidationError(issues)
        return message


class MessageSigner:
    def __init__(self, verifier: SignatureVerifier | None = None) -> None:
        self.verifier = verifier or SignatureVerifier()

    def sign_ed25519(self, message: RealtimeMailMessage, private_key: Any) -> RealtimeMailMessage:
        import base64

        signature = private_key.sign(self.verifier.canonical_message(message).encode("utf-8"))
        encoded = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
        return replace(message, signature=f"rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0.{encoded}")


class RouteAuthorizer:
    def __init__(self, manifest: RealtimeMailManifest) -> None:
        self.manifest = manifest

    def authorize(self, route: str, channel_id: str | None = None, user_id: str | None = None) -> tuple[bool, str]:
        for channel in self.manifest.channels:
            if channel_id and channel.id != channel_id:
                continue
            if _route_matches(channel.route, route, user_id):
                return True, "ok"
        return False, "route_not_allowed"


class ActionReceiver:
    def __init__(self, domain: str) -> None:
        self.domain = domain

    def receive(self, value: Any) -> tuple[bool, str, RealtimeMailAction | None]:
        issues = ActionValidator.validate(value)
        if issues:
            return False, "invalid_action", None
        action = action_from_dict(value)
        if action.domain != self.domain:
            return False, "domain_not_allowed", None
        return True, "ok", action


def _route_matches(pattern: str, route: str, user_id: str | None) -> bool:
    pattern_parts = [part for part in pattern.split("/") if part]
    route_parts = [part for part in route.split("/") if part]
    if len(pattern_parts) != len(route_parts):
        return False
    for pattern_part, route_part in zip(pattern_parts, route_parts):
        if pattern_part == ":userId":
            if not user_id or route_part != user_id:
                return False
        elif pattern_part.startswith(":"):
            continue
        elif pattern_part != route_part:
            return False
    return True


def _is_payment_request(payload: object | None) -> bool:
    return isinstance(payload, dict) and payload.get("kind") == "host-mediated-payment-request"


def _message_to_wire(message: RealtimeMailMessage) -> dict[str, Any]:
    return {
        "id": message.id,
        "source": message.source.value,
        "domain": message.domain,
        "channelId": message.channel_id,
        "from": message.from_address,
        "subject": message.subject,
        "html": message.html,
        "css": message.css,
        "script": message.script,
        "capabilities": [capability.value for capability in message.capabilities],
        "receivedAt": message.received_at.isoformat().replace("+00:00", "Z"),
        "expiresAt": message.expires_at.isoformat().replace("+00:00", "Z") if message.expires_at else None,
    }
