# Realtime Mail Specification

Version: `0.1-draft`

## Goals

- Keep compatibility with traditional email clients and accounts.
- Add a trusted realtime layer for domains that publish a manifest.
- Allow rich HTML, CSS, SVG, and sandboxed JavaScript only through explicit capabilities.
- Make messages portable across clients through open SDKs and a stable manifest format.

## Discovery

Clients discover domain support by requesting:

```txt
https://domain.tld/.well-known/realtime-mail.json
```

The response must be JSON and must declare:

- `protocol`: must be `realtime-mail`.
- `version`: manifest schema version.
- `domain`: canonical domain.
- `displayName`: user-facing sender name.
- `publicKeys`: message verification keys.
- `channels`: subscribable routes and required capabilities.

## Message Sources

`traditional` messages come from IMAP, POP, local mail stores, or provider APIs.

`realtime` messages come from a trusted realtime gateway. The client should not connect directly to RabbitMQ or another internal broker.

## Gateway

The gateway is the public transport boundary between clients and broker infrastructure.

Responsibilities:

- Authenticate the user.
- Authorize subscriptions against manifest channels.
- Verify message signatures.
- Enforce route scoping.
- Relay client actions back to the domain only after policy checks.

The draft repository includes a minimal SSE reference gateway in `reference/gateway`.

## Capabilities

Capabilities are explicit permissions attached to channels and messages:

- `render:html`
- `render:css`
- `render:svg`
- `run:script-sandboxed`
- `open-url:user-gesture`
- `storage:isolated`
- `network:domain-only`

Clients may implement fewer capabilities than the manifest asks for. Unsupported capabilities must fail closed.

## Schemas

Normative JSON Schemas live in `spec/schemas`:

- `manifest.schema.json`
- `message.schema.json`
- `action.schema.json`
- `payment-request.schema.json`

SDKs should validate against these contracts before trusting a manifest, message, or host-mediated action.

Schema validation is strict. Unknown properties must be rejected at parse or validation time so all clients interpret the same signed payload.

## Payment Requests

Host-mediated payment requests use the payload profile in `docs/payment-request-profile.md` and the normative schema in `spec/schemas/payment-request.schema.json`.

Payment messages must use the `payment-request:user-gesture` capability. The sandboxed message may request payment, but the host client owns confirmation, browser Payment Request API usage, provider checkout fallback, QR fallback, and result handling.

## Signatures

Realtime messages must be signed. The current draft format is:

```txt
rmail1.<base64url-protected>.<base64url-signature>
```

The payload to sign is the canonical message without the `signature` field. Ed25519 is recommended. ECDSA P-256 is allowed as a compatibility fallback.

If a message includes `expiresAt`, that field is included in the canonical signed payload. Clients should use it to disable interactive capabilities after expiry.

## Sandbox

Interactive messages must render in an isolated environment such as an iframe, webview, or host-native sandbox. Scripts must not access:

- Other messages.
- User mail accounts.
- Filesystem APIs.
- Authentication tokens.
- Host cookies.
- Unapproved network targets.

## Traditional Mail

Clients should keep traditional mail support as a first-class source. Realtime Mail is an upgrade path, not a replacement requirement.
