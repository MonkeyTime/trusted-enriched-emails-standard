# Roadmap

Project strategy and product direction live in `docs/project-direction.md`.

## Phase 1: Standard Core

- JSON Schemas for manifests, messages, and actions.
- SDK validators in TypeScript, Java, C#, Python, Go, and Rust.
- Shared conformance fixtures.
- Security model and threat model.
- Reference gateway skeleton.

Current check status:

- `npm.cmd run test` covers TypeScript, web client, conformance fixtures, crypto vector, HostActionBroker, optional RabbitMQ gateway integration, Python, Go, Rust, Java, and C#.
- `npm.cmd run rust:check` is available. On Windows it requires Rust's MSVC target, Visual Studio C++ build tools, and a Windows SDK.

## Phase 2: End-to-End Reference Flow

- Stable test signing keys.
- Gateway-signed demo messages.
- Client-side signature verification before rendering. (initial reference flow complete)
- Host-mediated action broker in the web client.
- SSE gateway transport in the TypeScript SDK.
- RabbitMQ-backed reference gateway adapter.
- RabbitMQ gateway integration test.

## Phase 3: Traditional Mail Integration

- Provider interfaces for IMAP/SMTP.
- Local backend bridge for browser clients.
- Thunderbird extension proof of integration.
- Unified message store.

## Phase 4: Production Hardening

- OAuth-based user authentication.
- Route authorization per user.
- Audit log persistence.
- Revocation lists.
- RabbitMQ TLS, credential rotation, dead-letter queues, and retry policy.
- Security review and fuzzing.

## Phase 5: Ecosystem

- Published SDK packages.
- Conformance CLI.
- Public standard website.
- Compatibility matrix.
- Implementer certification profile.
