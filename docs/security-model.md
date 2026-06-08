# Security Model

Realtime Mail treats every message as untrusted until the client can prove otherwise.

## Trust Boundary

Traditional mail and enriched mail share an inbox, but not a privilege model.

- Traditional mail may render sanitized HTML/CSS only.
- Realtime mail may request richer capabilities only when the domain is trusted, the manifest is valid, and the message signature verifies.
- JavaScript must run only in a sandboxed execution environment.

## Required Validation Pipeline

Clients should process enriched realtime messages in this order:

1. Resolve `/.well-known/realtime-mail.json`.
2. Validate the manifest against `spec/schemas/manifest.schema.json`.
3. Verify the domain identity through HTTPS and optional DNS proofs.
4. Verify that the channel exists in the manifest.
5. Validate the message against `spec/schemas/message.schema.json`.
6. Verify the message signature with a manifest public key.
7. Apply local trust policy and user revocations.
8. Render in sandbox with only approved capabilities.

SDK validators must reject unknown JSON properties. A signed message must not contain fields that one client ignores and another client later interprets as privileged instructions.

## Capabilities

Capabilities are deny-by-default. A client must ignore unsupported capabilities and block content that requires them.

Sensitive capabilities require extra controls:

- `run:script-sandboxed`: requires a signed realtime message and sandbox isolation.
- `open-url:user-gesture`: requires a visible user gesture.
- `payment-request:user-gesture`: requires a signed message, trusted domain, fresh user gesture, and host-owned payment confirmation.
- `network:domain-only`: restricts sandbox networking to approved origins.
- `storage:isolated`: isolates storage by user, domain, and channel.

## Sandbox Rules

Sandboxed content must not access:

- Mailbox data.
- Account credentials.
- Global cookies or storage.
- Local files.
- Host APIs except the host-mediated action bridge.

## Host-Mediated Actions

Messages must not directly perform privileged actions. They must request actions from the host.

The host must verify:

- The source message id.
- The trusted domain.
- The message signature.
- The required capability.
- The user gesture, when required.

The action request itself must validate against `spec/schemas/action.schema.json`. Current SDKs expose `ActionValidator` for this deny-by-default host boundary.

`open_url` actions must target an HTTPS URL on the same domain as the signed action request. Cross-domain redirects or deep links must be represented as ordinary links and opened through normal browser policy, not through the privileged action bridge.

Client SDKs should centralize these checks through a host action broker. The broker must authorize the action only after checking the source message id, domain trust, user gesture, expiry, signature verification, and the required capability.

### Payments

Realtime messages must not call browser payment APIs directly. A payment email may only ask the host client for a payment action.

The host client owns the payment flow:

- verify the signed source message and trusted domain;
- verify the request payload against the invoice shown to the user;
- require `payment-request:user-gesture`;
- require a fresh user gesture;
- prefer the browser Payment Request API when available;
- fall back to a host-controlled confirmation, provider checkout, or QR code when Payment Request is unavailable;
- never expose mailbox data, cards, payment tokens, or account credentials to the sandboxed message.

## Replay Controls

Messages may include `expiresAt`. When present, it is part of the canonical signed payload. Clients should treat expired enriched realtime messages as non-interactive even if they remain visible in the inbox.

## Revocation

Clients must support immediate local revocation for trusted domains. Revoked domains lose interactive privileges even if messages remain in the inbox.

## Cryptography

The draft signature format is:

```txt
rmail1.<base64url-protected>.<base64url-signature>
```

The signed payload should be the canonical message body without the `signature` field. SDKs expose canonicalization helpers so implementations can converge before the format is finalized.

Recommended algorithms:

- Ed25519 for modern runtimes.
- ECDSA P-256 as a compatibility fallback where Ed25519 is not available.

## Reference Implementation

The reference gateway in `reference/gateway` emits signed demo messages over SSE. It is intentionally minimal, but it exercises the same signature canonicalization path as the TypeScript SDK.
