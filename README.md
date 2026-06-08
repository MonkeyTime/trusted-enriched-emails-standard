# Realtime Mail Standard

Realtime Mail is an open proposal for trusted enriched email: signed, sandboxed, interactive messages delivered through traditional mail or realtime channels.

The product goal is not simply faster delivery. It is richer mail that can safely contain HTML, CSS, SVG, sandboxed JavaScript, mini-apps, payment requests, approvals, status panels, and other host-mediated actions without giving arbitrary email content direct access to the mailbox or user credentials.

The repository is structured as a standard plus SDKs:

- [Web client POC](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/apps/web-client): sandboxed web client POC with traditional mail and trusted enriched mail in one inbox.
- [TypeScript SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/typescript)
- [Java SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/java)
- [C# SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/csharp)
- [Python SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/python)
- [Go SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/go)
- [Rust SDK](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/packages/rust)
- [Official documentation](https://monkeytime.github.io/realtime-mail-standard/)
- [Trusted enriched email demo](https://monkeytime.github.io/realtime-mail-standard/demo.html)
- [Normative JSON Schemas](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/spec/schemas)
- [Conformance fixtures](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/conformance)
- [Thunderbird integration notes](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/integrations/thunderbird)
- [Examples](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/examples)
- [Reference gateway](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/reference/gateway): SSE reference gateway with signed demo messages and optional RabbitMQ broker adapter.

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

Open the web client, use the gateway action buttons to publish a signed enriched event, mini-game, or payment request.

Expected result:

- the client loads the gateway manifest;
- the client subscribes over SSE;
- the gateway signs an enriched realtime message;
- the client verifies the Ed25519 signature;
- the message is displayed with a verified signature label.
- sandboxed JavaScript can run only for signed trusted messages;
- payment requests are handled by the host client, with Payment Request API used only when available.

## Core idea

Traditional email remains supported. A client can additionally discover a realtime manifest at:

```txt
https://domain.tld/.well-known/realtime-mail.json
```

If the domain is trusted, the client can subscribe to declared channels through an authenticated gateway. Enriched content is rendered in a sandbox with explicit capabilities.

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

## Documentation

- [Documentation home](https://monkeytime.github.io/realtime-mail-standard/)
- [Trusted enriched email demo](https://monkeytime.github.io/realtime-mail-standard/demo.html)
- [Developer quickstart](https://monkeytime.github.io/realtime-mail-standard/guides/developer-quickstart.html)
- [Specification](https://monkeytime.github.io/realtime-mail-standard/specification.html)
- [Security model](https://monkeytime.github.io/realtime-mail-standard/security-model.html)
- [Threat model](https://monkeytime.github.io/realtime-mail-standard/threat-model.html)
- [Gateway SDK profile](https://monkeytime.github.io/realtime-mail-standard/gateway-sdk-profile.html)
- [Host-mediated payment request profile](https://monkeytime.github.io/realtime-mail-standard/payment-request-profile.html)
- [State policy](https://monkeytime.github.io/realtime-mail-standard/state-policy.html)
- [SDK compatibility matrix](https://monkeytime.github.io/realtime-mail-standard/sdk-compatibility.html)
- [SDK release checklist](https://monkeytime.github.io/realtime-mail-standard/sdk-release-checklist.html)
- [POC completion status](https://monkeytime.github.io/realtime-mail-standard/poc-completion.html)
- [Roadmap](https://monkeytime.github.io/realtime-mail-standard/roadmap.html)
- [Architecture decision records](https://github.com/MonkeyTime/realtime-mail-standard/tree/main/docs/adr)

## License

This project is licensed under the [MIT License](https://github.com/MonkeyTime/realtime-mail-standard/blob/main/LICENSE).

The software is provided "as is", without warranty of any kind, express or implied. See the license text for the full warranty and liability disclaimer.
