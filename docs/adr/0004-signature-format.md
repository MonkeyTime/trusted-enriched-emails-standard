# ADR 0004: Draft Signature Format

## Status

Draft

## Context

Realtime messages must be portable across SDKs and verifiable before rendering.

## Decision

Use a compact draft signature format:

```txt
rmail1.<base64url-header>.<base64url-signature>
```

The signed data is the canonical message without the `signature` field.

## Consequences

The format is simple to implement while the standard is young. A future revision may adopt detached JWS if interoperability needs outweigh this simplicity.
