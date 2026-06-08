# Realtime Mail Standard

Realtime Mail is an open proposal for trusted, interactive, realtime email experiences.

The repository is structured as a standard plus SDKs:

- `apps/web-client`: sandboxed web client POC with traditional mail and realtime mail in one inbox.
- `packages/typescript`: TypeScript SDK.
- `packages/java`: Java SDK.
- `packages/csharp`: C# SDK.
- `packages/python`: Python SDK.
- `packages/go`: Go SDK.
- `packages/rust`: Rust SDK.
- `docs`: official specification and API reference.
- `spec/schemas`: normative JSON Schemas.
- `conformance`: shared valid and invalid fixtures for SDK compatibility.
- `integrations/thunderbird`: client integration notes.
- `examples`: manifests and message examples.
- `reference/gateway`: SSE reference gateway with signed demo messages and optional RabbitMQ broker adapter.

## Run the web client

```bash
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`.

## Build

```bash
npm.cmd run build
npm.cmd run build -w @realtimemail/sdk
npm.cmd run test
npm.cmd run python:check
npm.cmd run go:check
npm.cmd run java:check
npm.cmd run csharp:conformance
npm.cmd run rust:check
npm.cmd run rabbitmq:test
```

Java, C#, Python, Go, and Rust packages are scaffolded with their native package metadata.

On Windows, `npm.cmd run rust:check` requires the Rust MSVC target plus the Visual Studio C++ build tools and a Windows SDK. If Cargo is installed but the MSVC environment is incomplete, the check reports the missing prerequisite before compiling the Rust SDK.

## Reference gateway

```bash
npm.cmd run gateway:start
```

By default the gateway uses an in-memory broker. To test with RabbitMQ:

```bash
$env:AMQP_URL="amqp://guest:guest@127.0.0.1:5672"
npm.cmd run gateway:start
```

Useful endpoints:

- `GET http://127.0.0.1:8787/.well-known/realtime-mail.json`
- `GET http://127.0.0.1:8787/events?route=/rt/invoices/demo-user`
- `POST http://127.0.0.1:8787/publish-demo?route=/rt/invoices/demo-user`
- `POST http://127.0.0.1:8787/publish-game-demo?route=/rt/invoices/demo-user`
- `POST http://127.0.0.1:8787/publish-payment-demo?route=/rt/invoices/demo-user`

RabbitMQ integration test:

```bash
$env:AMQP_URL="amqp://guest:guest@127.0.0.1:5672"
$env:REQUIRE_RABBITMQ="1"
npm.cmd run rabbitmq:test
```

## End-to-end demo

Run the gateway and the web client:

```bash
npm.cmd run gateway:start
npm.cmd run dev
```

Open the web client, use the gateway action buttons to publish a signed event, mini-game, or payment request.

Expected result:

- the client loads the gateway manifest;
- the client subscribes over SSE;
- the gateway signs a realtime message;
- the client verifies the Ed25519 signature;
- the message is displayed with a verified signature label.
- sandboxed JavaScript can run only for signed trusted messages;
- payment requests are handled by the host client, with Payment Request API used only when available.

## Core idea

Traditional email remains supported. A client can additionally discover a realtime manifest at:

```txt
https://domain.tld/.well-known/realtime-mail.json
```

If the domain is trusted, the client can subscribe to declared channels through an authenticated gateway. Rich content is rendered in a sandbox with explicit capabilities.

## Security-first SDK surface

SDKs now include the POC security primitives:

- manifest validators;
- message validators;
- action and payment request validators;
- validation errors with paths;
- signature canonicalization and verification;
- trust policy;
- state policy;
- host action authorization;
- payment request security authorization;
- gateway profile helpers.

For the current milestone, the SDKs are the primary reusable output. The web client and gateway are reference implementations that prove the flow.

See also:

- `docs/security-model.md`
- `docs/gateway-sdk-profile.md`
- `docs/project-direction.md`
- `docs/payment-request-profile.md`
- `docs/sdk-compatibility.md`
- `docs/state-policy.md`
- `docs/threat-model.md`
- `docs/roadmap.md`
- `docs/poc-completion.md`
- `docs/sdk-release-checklist.md`
- `docs/adr`
