from __future__ import annotations

import base64
import json

from .models import RealtimeMailMessage, message_to_canonical_dict


class SignatureVerifier:
    def canonical_message(self, message: RealtimeMailMessage) -> str:
        return json.dumps(message_to_canonical_dict(message), separators=(",", ":"), sort_keys=True)

    def verify_ed25519(self, message: RealtimeMailMessage, public_key: str) -> bool:
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        except Exception:
            return False

        if not message.signature or not public_key.startswith("ed25519:"):
            return False
        try:
            key_bytes = _base64url_decode(public_key.removeprefix("ed25519:"))
            signature = _signature_bytes(message.signature)
            Ed25519PublicKey.from_public_bytes(key_bytes).verify(
                signature,
                self.canonical_message(message).encode("utf-8"),
            )
            return True
        except Exception:
            return False


def _signature_bytes(signature: str) -> bytes:
    if signature.startswith("rmail1."):
        return _base64url_decode(signature.split(".")[2])
    return _base64url_decode(signature.removeprefix("ed25519:"))


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
