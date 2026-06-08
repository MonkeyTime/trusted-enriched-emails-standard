# POC Completion Status

This document defines the intended stopping point for the current proof of concept.

The POC is considered complete when it proves the full Realtime Mail trust loop:

1. A trusted domain publishes a manifest.
2. A gateway builds and signs enriched realtime messages.
3. A client subscribes to a realtime route through a gateway, not directly to the broker.
4. The client validates the manifest, signature, domain state, message state, capabilities, expiry, and sandbox policy before rendering.
5. Interactive HTML, CSS, SVG, and JavaScript run only inside a sandbox.
6. Privileged actions are mediated by the host client.
7. Payment requests use a standard payload and are authorized by host policy before any payment UX starts.
8. Traditional mail remains visible in the same client model.

## Completed POC Slice

- Web client POC with traditional and enriched messages in one inbox.
- Trusted domain state model: `trusted`, `muted`, and `revoked`.
- Message lifecycle model: `visible`, `dismissed`, `deleted`, `superseded`, and `expired`.
- Signed gateway messages over SSE.
- RabbitMQ-backed reference gateway path.
- Signed mini-game email demo.
- Signed host-mediated payment request demo.
- QR payment fallback payload.
- Host payment mediation with browser Payment Request API attempted only when available.
- Security details panel in the reference client.
- Gateway diagnostics, reconnect scheduling, and audit events.
- Process-local replay guards for reference gateway messages and actions.
- Cross-SDK validation and security tests.

## POC Boundaries

The POC intentionally does not attempt to be a production mail client, production payment system, or production gateway.

The web client is a reference experience. It should prove the trust model and developer flow, not replace Thunderbird or a native mail app.

The reference gateway is a demo gateway. It should prove route authorization, signing, broker bridging, audit events, and replay guards, but it still needs durable production infrastructure before real deployment.

The SDKs are the most important reusable output of the POC. They should stay aligned, documented, tested, and deny-by-default.

## Production Work Not Included

- Real OAuth/JWT user authentication.
- Persistent signing keys and key rotation.
- Durable audit logs.
- Durable replay storage.
- Rate limiting and abuse protection.
- Multi-tenant isolation.
- Production RabbitMQ TLS, credential rotation, retry policy, and dead-letter queues.
- IMAP/SMTP OAuth account bridge.
- Thunderbird extension implementation.
- Published SDK packages.
- Formal certification process.

## Recommended Stop Point

For the current milestone, stop after:

- SDK APIs are aligned across TypeScript, Python, Go, Rust, Java, and C#.
- SDK reference docs list the public classes and methods.
- The developer quickstart explains the end-to-end path.
- The security model clearly separates mandatory checks from production hardening.
- `npm.cmd run test` and `npm.cmd run docs:build` pass.

Further work should be planned as a separate release or implementation milestone.
