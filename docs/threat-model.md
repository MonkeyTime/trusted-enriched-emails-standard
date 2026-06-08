# Threat Model

## Assets

- User mailbox content.
- Traditional mail account credentials.
- Realtime channel authorization.
- Domain trust decisions.
- Host-mediated action permissions.
- Sandbox integrity.

## Trust Boundaries

- Domain manifest boundary: public web to client trust store.
- Gateway boundary: external realtime transport to local inbox.
- Sandbox boundary: untrusted message content to host client.
- Traditional mail boundary: IMAP/SMTP/provider APIs to unified inbox.

## Threats

### Phishing by Lookalike Domain

An attacker publishes a manifest for a similar domain and sends convincing interactive content.

Mitigations:

- Show canonical domain prominently.
- Do not inherit trust across domains.
- Require explicit trust decisions.
- Support domain revocation.

### Malicious Manifest

A domain asks for broad capabilities or routes outside its authority.

Mitigations:

- Validate manifest schema.
- Restrict routes to declared channel patterns.
- Deny unsupported capabilities.

### Message Replay

A valid signed message is replayed after context changes.

Mitigations:

- Require `receivedAt` and optional `expiresAt`.
- Add nonce or message id tracking in clients.
- Gateway should reject duplicate message ids per channel.

### Sandbox Escape

Interactive content attempts to reach host APIs, mailbox data, or global storage.

Mitigations:

- Use sandboxed iframe or equivalent native sandbox.
- No host APIs except a narrow action bridge.
- Validate all `postMessage` payloads.
- Isolate storage by user, domain, and channel.

### Unauthorized Host Action

Message content requests a privileged action such as opening a URL or publishing a gateway event.

Mitigations:

- Validate action schema.
- Require declared capability.
- Require user gesture for external effects.
- Verify source message signature and domain.

### Gateway Abuse

An attacker floods subscriptions or publishes messages on routes they do not own.

Mitigations:

- Authenticate users.
- Authorize channel routes per user and manifest.
- Rate-limit connections and publications.
- Persist audit logs.

### Tracking and Fingerprinting

Interactive content attempts to track reads or fingerprint users.

Mitigations:

- Block implicit network access by default.
- Require `network:domain-only` for outbound requests.
- Proxy or strip remote assets for traditional mail.
- Make read receipts opt-in.
