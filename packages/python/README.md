# Realtime Mail Python SDK

Python SDK for validators, canonicalization, trust policy, and optional signature verification.

The package has no hard runtime dependency. Ed25519 verification uses `cryptography` when installed through the `crypto` extra.

```bash
pip install -e ".[crypto]"
```
