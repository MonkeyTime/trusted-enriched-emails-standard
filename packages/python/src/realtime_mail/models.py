from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class TrustCapability(StrEnum):
    RENDER_HTML = "render:html"
    RENDER_CSS = "render:css"
    RENDER_SVG = "render:svg"
    RUN_SCRIPT_SANDBOXED = "run:script-sandboxed"
    OPEN_URL_USER_GESTURE = "open-url:user-gesture"
    PAYMENT_REQUEST_USER_GESTURE = "payment-request:user-gesture"
    STORAGE_ISOLATED = "storage:isolated"
    NETWORK_DOMAIN_ONLY = "network:domain-only"


class MailSource(StrEnum):
    TRADITIONAL = "traditional"
    REALTIME = "realtime"


class TrustedDomainState(StrEnum):
    TRUSTED = "trusted"
    MUTED = "muted"
    REVOKED = "revoked"


class MessageLifecycleState(StrEnum):
    VISIBLE = "visible"
    DISMISSED = "dismissed"
    DELETED = "deleted"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"


class RealtimeMailActionType(StrEnum):
    OPEN_URL = "open_url"
    PUBLISH_GATEWAY_EVENT = "publish_gateway_event"
    REQUEST_NOTIFICATION = "request_notification"
    STORE_ISOLATED_VALUE = "store_isolated_value"


@dataclass(frozen=True)
class RealtimeMailChannel:
    id: str
    label: str
    route: str
    capabilities: list[TrustCapability]
    description: str | None = None


@dataclass(frozen=True)
class RealtimeMailManifest:
    protocol: str
    version: str
    domain: str
    display_name: str
    public_keys: list[str]
    channels: list[RealtimeMailChannel]


@dataclass(frozen=True)
class RealtimeMailMessage:
    id: str
    source: MailSource
    domain: str
    from_address: str
    subject: str
    html: str
    capabilities: list[TrustCapability]
    received_at: datetime
    expires_at: datetime | None = None
    channel_id: str | None = None
    css: str | None = None
    script: str | None = None
    signature: str | None = None


@dataclass(frozen=True)
class TraditionalMailAccount:
    id: str
    email: str
    provider: str
    incoming_host: str
    outgoing_host: str


@dataclass(frozen=True)
class RealtimeMailAction:
    id: str
    message_id: str
    domain: str
    type: RealtimeMailActionType
    requires_user_gesture: bool
    url: str | None = None
    payload: object | None = None


def manifest_from_dict(value: dict) -> RealtimeMailManifest:
    return RealtimeMailManifest(
        protocol=value["protocol"],
        version=value["version"],
        domain=value["domain"],
        display_name=value["displayName"],
        public_keys=list(value["publicKeys"]),
        channels=[
            RealtimeMailChannel(
                id=channel["id"],
                label=channel["label"],
                route=channel["route"],
                description=channel.get("description"),
                capabilities=[TrustCapability(capability) for capability in channel.get("capabilities", [])],
            )
            for channel in value["channels"]
        ],
    )


def message_from_dict(value: dict) -> RealtimeMailMessage:
    received_at = value["receivedAt"]
    if isinstance(received_at, str):
        received_at = datetime.fromisoformat(received_at.replace("Z", "+00:00"))
    expires_at = value.get("expiresAt")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    return RealtimeMailMessage(
        id=value["id"],
        source=MailSource(value["source"]),
        domain=value["domain"],
        channel_id=value.get("channelId"),
        from_address=value["from"],
        subject=value["subject"],
        html=value["html"],
        css=value.get("css"),
        script=value.get("script"),
        capabilities=[TrustCapability(capability) for capability in value.get("capabilities", [])],
        received_at=received_at,
        expires_at=expires_at,
        signature=value.get("signature"),
    )


def action_from_dict(value: dict) -> RealtimeMailAction:
    return RealtimeMailAction(
        id=value["id"],
        message_id=value["messageId"],
        domain=value["domain"],
        type=RealtimeMailActionType(value["type"]),
        requires_user_gesture=value["requiresUserGesture"],
        url=value.get("url"),
        payload=value.get("payload"),
    )


def message_to_canonical_dict(message: RealtimeMailMessage) -> dict:
    value = {
        "capabilities": [capability.value for capability in message.capabilities],
        "channelId": message.channel_id,
        "css": message.css,
        "domain": message.domain,
        "from": message.from_address,
        "html": message.html,
        "id": message.id,
        "receivedAt": message.received_at.isoformat().replace("+00:00", "Z"),
        "expiresAt": message.expires_at.isoformat().replace("+00:00", "Z") if message.expires_at else None,
        "script": message.script,
        "source": message.source.value,
        "subject": message.subject,
    }
    return {key: item for key, item in value.items() if item is not None}
