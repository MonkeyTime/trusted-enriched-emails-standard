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
        return issues

    @staticmethod
    def parse(value: Any):
        issues = ActionValidator.validate(value)
        if issues:
            raise ValidationError(issues)
        return action_from_dict(value)


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


def _known_properties(value: dict[str, Any], path: str, allowed: set[str], issues: list[ValidationIssue]) -> None:
    for key in value:
        if key not in allowed:
            issues.append(ValidationIssue(f"{path}.{key}", "is not a supported property"))
