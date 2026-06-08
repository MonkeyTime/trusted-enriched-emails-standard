from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from .models import RealtimeMailActionType, TrustCapability, action_from_dict, manifest_from_dict, message_from_dict

DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")
CHANNEL_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
PUBLIC_KEY = re.compile(r"^(ed25519|ecdsa-p256):[A-Za-z0-9_-]+={0,2}$")
MANIFEST_PROPERTIES = {"protocol", "version", "domain", "displayName", "publicKeys", "channels"}
CHANNEL_PROPERTIES = {"id", "label", "route", "description", "capabilities"}
MESSAGE_PROPERTIES = {
    "id",
    "source",
    "domain",
    "channelId",
    "from",
    "subject",
    "html",
    "css",
    "script",
    "capabilities",
    "receivedAt",
    "expiresAt",
    "signature",
}
ACTION_PROPERTIES = {"id", "messageId", "domain", "type", "requiresUserGesture", "url", "payload"}
PAYMENT_REQUEST_PROPERTIES = {"kind", "invoiceId", "merchant", "amount", "description", "orderReference", "confirmationUx", "fallbackProvider", "expiresAt"}
PAYMENT_MERCHANT_PROPERTIES = {"domain", "displayName"}
PAYMENT_AMOUNT_PROPERTIES = {"value", "currency"}
PAYMENT_FALLBACK_PROPERTIES = {"type", "label", "url", "qrPayload"}
PAYMENT_CONFIRMATION_UX = {"browser_payment_request", "host_confirmation", "provider_checkout", "qr_code"}
PAYMENT_FALLBACK_TYPES = {"provider_checkout", "qr_code"}


@dataclass(frozen=True)
class ValidationIssue:
    path: str
    message: str


class ValidationError(Exception):
    def __init__(self, issues: list[ValidationIssue]) -> None:
        super().__init__("; ".join(f"{issue.path}: {issue.message}" for issue in issues))
        self.issues = issues


class ManifestValidator:
    @staticmethod
    def validate(value: Any) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if not isinstance(value, dict):
            return [ValidationIssue("$", "must be an object")]
        _known_properties(value, "$", MANIFEST_PROPERTIES, issues)
        if value.get("protocol") != "realtime-mail":
            issues.append(ValidationIssue("$.protocol", "must equal realtime-mail"))
        _string(value.get("version"), "$.version", issues)
        _domain(value.get("domain"), "$.domain", issues)
        _string(value.get("displayName"), "$.displayName", issues)
        _string_array(value.get("publicKeys"), "$.publicKeys", issues, PUBLIC_KEY)
        channels = value.get("channels")
        if not isinstance(channels, list) or not channels:
            issues.append(ValidationIssue("$.channels", "must be a non-empty array"))
        else:
            for index, channel in enumerate(channels):
                _channel(channel, f"$.channels[{index}]", issues)
        return issues

    @staticmethod
    def parse(value: Any):
        issues = ManifestValidator.validate(value)
        if issues:
            raise ValidationError(issues)
        return manifest_from_dict(value)


class MessageValidator:
    @staticmethod
    def validate(value: Any) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if not isinstance(value, dict):
            return [ValidationIssue("$", "must be an object")]
        _known_properties(value, "$", MESSAGE_PROPERTIES, issues)
        _string(value.get("id"), "$.id", issues)
        if value.get("source") not in {"traditional", "realtime"}:
            issues.append(ValidationIssue("$.source", "must be traditional or realtime"))
        _domain(value.get("domain"), "$.domain", issues)
        _string(value.get("from"), "$.from", issues)
        _string(value.get("subject"), "$.subject", issues, allow_empty=True)
        _string(value.get("html"), "$.html", issues)
        _capabilities(value.get("capabilities"), "$.capabilities", issues)
        _string(value.get("receivedAt"), "$.receivedAt", issues)
        if value.get("expiresAt") is not None:
            _string(value.get("expiresAt"), "$.expiresAt", issues)
        if value.get("source") == "realtime":
            _string(value.get("channelId"), "$.channelId", issues)
            _string(value.get("signature"), "$.signature", issues)
        if value.get("script") is not None and "run:script-sandboxed" not in value.get("capabilities", []):
            issues.append(ValidationIssue("$.capabilities", "must include run:script-sandboxed when script is present"))
        return issues

    @staticmethod
    def parse(value: Any):
        issues = MessageValidator.validate(value)
        if issues:
            raise ValidationError(issues)
        return message_from_dict(value)


class ActionValidator:
    @staticmethod
    def validate(value: Any) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if not isinstance(value, dict):
            return [ValidationIssue("$", "must be an object")]
        _known_properties(value, "$", ACTION_PROPERTIES, issues)
        if not isinstance(value.get("id"), str) or not CHANNEL_ID.match(value["id"]):
            issues.append(ValidationIssue("$.id", "must be a valid action id"))
        _string(value.get("messageId"), "$.messageId", issues)
        _domain(value.get("domain"), "$.domain", issues)
        if value.get("type") not in {action.value for action in RealtimeMailActionType}:
            issues.append(ValidationIssue("$.type", "must be a supported action type"))
        if value.get("requiresUserGesture") is not True:
            issues.append(ValidationIssue("$.requiresUserGesture", "must be true"))
        if value.get("type") == RealtimeMailActionType.OPEN_URL.value:
            parsed = urlparse(value.get("url", ""))
            if parsed.scheme != "https" or parsed.hostname != value.get("domain"):
                issues.append(ValidationIssue("$.url", "must be an https URL for the action domain"))
        payload = value.get("payload")
        if isinstance(payload, dict) and payload.get("kind") == "host-mediated-payment-request":
            issues.extend(ValidationIssue(f"$.payload{issue.path[1:]}", issue.message) for issue in PaymentRequestPayloadValidator.validate(payload))
            if value.get("type") != RealtimeMailActionType.PUBLISH_GATEWAY_EVENT.value:
                issues.append(ValidationIssue("$.type", "must be publish_gateway_event for payment requests"))
            merchant = payload.get("merchant")
            if isinstance(merchant, dict) and merchant.get("domain") != value.get("domain"):
                issues.append(ValidationIssue("$.payload.merchant.domain", "must match action domain"))
        return issues

    @staticmethod
    def parse(value: Any):
        issues = ActionValidator.validate(value)
        if issues:
            raise ValidationError(issues)
        return action_from_dict(value)


class PaymentRequestPayloadValidator:
    @staticmethod
    def validate(value: Any) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if not isinstance(value, dict):
            return [ValidationIssue("$", "must be an object")]
        _known_properties(value, "$", PAYMENT_REQUEST_PROPERTIES, issues)
        if value.get("kind") != "host-mediated-payment-request":
            issues.append(ValidationIssue("$.kind", "must equal host-mediated-payment-request"))
        _string(value.get("invoiceId"), "$.invoiceId", issues)
        _payment_merchant(value.get("merchant"), "$.merchant", issues)
        _payment_amount(value.get("amount"), "$.amount", issues)
        _string(value.get("description"), "$.description", issues)
        if value.get("orderReference") is not None:
            _string(value.get("orderReference"), "$.orderReference", issues)
        if value.get("confirmationUx") not in PAYMENT_CONFIRMATION_UX:
            issues.append(ValidationIssue("$.confirmationUx", "must be a supported confirmation UX"))
        if value.get("fallbackProvider") is not None:
            _payment_fallback(value.get("fallbackProvider"), "$.fallbackProvider", issues)
        merchant = value.get("merchant")
        fallback = value.get("fallbackProvider")
        if isinstance(merchant, dict) and isinstance(fallback, dict):
            _validate_fallback_domain(fallback, str(merchant.get("domain")), "$.fallbackProvider", issues)
        _string(value.get("expiresAt"), "$.expiresAt", issues)
        return issues

    @staticmethod
    def parse(value: Any):
        issues = PaymentRequestPayloadValidator.validate(value)
        if issues:
            raise ValidationError(issues)
        return value


def _string(value: Any, path: str, issues: list[ValidationIssue], allow_empty: bool = False) -> None:
    if not isinstance(value, str) or (not allow_empty and not value):
        issues.append(ValidationIssue(path, "must be a string"))


def _domain(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    if not isinstance(value, str) or not DOMAIN.match(value):
        issues.append(ValidationIssue(path, "must be a valid domain"))


def _string_array(value: Any, path: str, issues: list[ValidationIssue], pattern: re.Pattern[str]) -> None:
    if not isinstance(value, list) or not value:
        issues.append(ValidationIssue(path, "must be a non-empty string array"))
        return
    for index, item in enumerate(value):
        if not isinstance(item, str) or not pattern.match(item):
            issues.append(ValidationIssue(f"{path}[{index}]", "must be a valid string value"))


def _capabilities(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    allowed = {capability.value for capability in TrustCapability}
    if not isinstance(value, list):
        issues.append(ValidationIssue(path, "must be an array"))
        return
    for index, item in enumerate(value):
        if item not in allowed:
            issues.append(ValidationIssue(f"{path}[{index}]", "must be a supported capability"))


def _channel(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    if not isinstance(value, dict):
        issues.append(ValidationIssue(path, "must be an object"))
        return
    _known_properties(value, path, CHANNEL_PROPERTIES, issues)
    if not isinstance(value.get("id"), str) or not CHANNEL_ID.match(value["id"]):
        issues.append(ValidationIssue(f"{path}.id", "must be a valid channel id"))
    _string(value.get("label"), f"{path}.label", issues)
    _string(value.get("route"), f"{path}.route", issues)
    _capabilities(value.get("capabilities"), f"{path}.capabilities", issues)


def _payment_merchant(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    if not isinstance(value, dict):
        issues.append(ValidationIssue(path, "must be an object"))
        return
    _known_properties(value, path, PAYMENT_MERCHANT_PROPERTIES, issues)
    _domain(value.get("domain"), f"{path}.domain", issues)
    _string(value.get("displayName"), f"{path}.displayName", issues)


def _payment_amount(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    if not isinstance(value, dict):
        issues.append(ValidationIssue(path, "must be an object"))
        return
    _known_properties(value, path, PAYMENT_AMOUNT_PROPERTIES, issues)
    _string(value.get("value"), f"{path}.value", issues)
    _string(value.get("currency"), f"{path}.currency", issues)


def _payment_fallback(value: Any, path: str, issues: list[ValidationIssue]) -> None:
    if not isinstance(value, dict):
        issues.append(ValidationIssue(path, "must be an object"))
        return
    _known_properties(value, path, PAYMENT_FALLBACK_PROPERTIES, issues)
    if value.get("type") not in PAYMENT_FALLBACK_TYPES:
        issues.append(ValidationIssue(f"{path}.type", "must be a supported fallback provider type"))
    _string(value.get("label"), f"{path}.label", issues)
    if value.get("url") is not None:
        _string(value.get("url"), f"{path}.url", issues)
    if value.get("qrPayload") is not None:
        _string(value.get("qrPayload"), f"{path}.qrPayload", issues)


def _validate_fallback_domain(value: dict[str, Any], merchant_domain: str, path: str, issues: list[ValidationIssue]) -> None:
    for key in ("url", "qrPayload"):
        payload = value.get(key)
        if not isinstance(payload, str) or not payload.startswith("https://"):
            continue
        parsed = urlparse(payload)
        if parsed.hostname != merchant_domain:
            issues.append(ValidationIssue(f"{path}.{key}", "must stay on the merchant domain"))


def _known_properties(value: dict[str, Any], path: str, allowed: set[str], issues: list[ValidationIssue]) -> None:
    for key in value:
        if key not in allowed:
            issues.append(ValidationIssue(f"{path}.{key}", "is not a supported property"))
