# Roadmap

Project strategy and product direction live in `docs/project-direction.md`.

This roadmap tracks the standard, SDKs, reference gateway, and web client together. It is intentionally split into current status and future work so implementers can see what is usable today and what still needs hardening.

## Completed

### Standard Core

- JSON Schemas for manifests, messages, actions, and host-mediated payment requests.
- Shared valid and invalid conformance fixtures.
- Security model and threat model.
- ADRs for the standard shape, gateway boundary, language scope, and signature format.
- Public documentation site generated from Markdown through GitHub Pages.

### Official SDK Baseline

- TypeScript, Java, C#, Python, Go, and Rust SDKs.
- Manifest, message, and action validators.
- Trust capability definitions.
- Trusted domain states: `trusted`, `muted`, and `revoked`.
- Message lifecycle states: `visible`, `dismissed`, `deleted`, `superseded`, and `expired`.
- Gateway SDK profile primitives: `RealtimeMessageBuilder`, `MessageSigner`, `RouteAuthorizer`, and `ActionReceiver`.
- Cross-SDK route authorization policy: only the standard `:userId` placeholder is accepted; unknown placeholders reject.
- Cross-SDK conformance and gateway security tests.

### End-to-End Reference Flow

- Web client POC with realtime and traditional mail in one inbox.
- Client-side signature verification before trusted rendering.
- Signed gateway demo messages.
- Signed interactive mini-game email demo.
- Signed host-mediated payment request email demo.
- Browser Payment Request API attempt when available.
- Host-controlled payment fallback path.
- QR payment fallback payload support.
- SSE gateway transport in the TypeScript SDK.
- Reference gateway with in-memory and RabbitMQ broker adapters.
- RabbitMQ integration test using the real broker path.
- Reference gateway user-bound route authorization.
- Reference gateway configurable origin allowlist.
- Reference gateway process-local replay guards for message ids and action ids.
- Reference gateway structured audit events.

### Web Client UX

- Day/night theme switch.
- Compact trusted-domain sidebar.
- Hover-expanded trusted-domain controls.
- Resizable trusted-domain, inbox, reader, and audit columns.
- Persistent trusted domain, subscription, deleted message, and layout state.
- English default locale with French translations kept in `apps/web-client/src/i18n.ts`.
- Security details panel per realtime message with trust, signature, capability, expiry, sandbox, CSP, and payment status.
- Explicit dismissed and superseded message controls.
- Language selector with English as the default locale.
- Gateway diagnostics with last error, reconnect attempts, last event time, and reconnect scheduling.

### Security Hardening

- HostActionBroker checks for trusted domain, capability, user gesture, message expiry, and source message.
- PaymentRequestSecurityPolicy checks payment capability, signed message context, merchant domain, amount, currency, expiry, iframe source, QR payload domain, and invoice idempotence.
- Web client host DOM escaping for message, account, domain, channel, and action surfaces.
- Sandbox iframe source validation for host-mediated actions.
- Fresh user gesture requirement for sandbox-originated actions.
- Restrictive sandbox CSP: no network connections, forms, frames, or default external loads; scripts only when capability-approved.
- Gateway message verification bound to the trusted manifest domain.
- Manifest discovery domain validation before URL construction in SDKs with resolver helpers.
- Reference gateway CORS narrowed to local app origins.
- Attack tests for missing payment capability, tampered amount, mismatched merchant domain, expired message, wrong iframe source, external QR payload, and duplicate invoice id.

### Governance

- Public GitHub repository.
- GitHub Pages documentation.
- Branch protection and public pull request restriction workflow.
- SDK compatibility matrix.

## In Progress

### SDK Parity

- Keep TypeScript, Java, C#, Python, Go, and Rust aligned whenever schemas or state policies change.
- Expand Java, C#, Python, Go, and Rust payment helpers beyond validation into full payment authorization parity with TypeScript.
- Add more canonicalization and signature vectors across every SDK.
- Keep generated or hand-written SDK reference pages synchronized with public APIs.

### Reference Client

- Add Playwright coverage for real iframe click-to-action flows and synthetic `postMessage` rejection.

## Next

### Traditional Mail Integration

- Provider interfaces for IMAP and SMTP.
- OAuth provider abstraction for traditional mail accounts.
- Local backend bridge for browser clients.
- Unified message store spanning traditional and realtime messages.
- Thunderbird extension proof of integration.
- Account isolation and permission model for traditional mail credentials.

### Production Gateway Hardening

- OAuth or JWT-based client authentication.
- Per-user route binding and tenant isolation.
- Rate limiting and abuse protection.
- Audit log persistence.
- Revocation lists for domains, keys, messages, and routes.
- RabbitMQ TLS defaults.
- Broker credential rotation.
- Dead-letter queues and retry policy.
- Durable queues where appropriate.
- Production deployment guide.

### Security Testing

- Browser security tests with Playwright.
- Hostile HTML, CSS, SVG, and JavaScript corpus.
- Schema fuzzing.
- Signature and canonicalization fuzzing.
- Cross-SDK differential tests.
- Gateway origin, replay, and route-binding attack tests.
- Payment attack corpus shared across SDKs.

### Developer Experience

- Conformance CLI.
- SDK package publishing pipelines.
- Browser and Node package targets for the TypeScript SDK.
- Gateway starter template.
- Trusted-domain implementation guide.
- Compatibility badges for SDKs and clients.

## Later

### Ecosystem

- Implementer certification profile.
- Public registry or discovery catalog for compatible clients and gateways.
- Reference native client integration.
- Additional broker adapters such as Kafka, NATS, Redis Streams, and provider webhooks.
- WebAssembly security core candidate, likely built from the Rust SDK.

### Standardization

- Versioned draft releases.
- Capability extension process.
- Formal interoperability test suite.
- Long-term governance model.

## Current Check Status

- `npm.cmd run test` covers TypeScript, web client, conformance fixtures, crypto vector, HostActionBroker, payment attack cases, web client state, RabbitMQ gateway integration, Python, Go, Rust, Java, and C#.
- `npm.cmd run rust:check` is available. On Windows it requires Rust's MSVC target, Visual Studio C++ build tools, and a Windows SDK.
