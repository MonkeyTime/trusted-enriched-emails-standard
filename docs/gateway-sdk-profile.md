# Gateway SDK Profile

The Gateway SDK profile is for trusted domains that publish realtime mail.

It shares the Core SDK validation and signing primitives with mail clients, but its responsibilities are different:

- build conformant realtime messages;
- sign messages before publishing;
- authorize user routes against manifest channels;
- validate host-mediated actions returned by clients;
- bridge domain infrastructure such as RabbitMQ, Kafka, NATS, Redis Streams, or SSE.

## Core Classes

### `RealtimeMessageBuilder`

Builds unsigned realtime messages from a validated manifest channel.

Responsibilities:

- set `source` to `realtime`;
- set the manifest domain;
- copy default channel capabilities;
- attach `receivedAt` and optional `expiresAt`;
- reject unknown channel ids.

### `MessageSigner`

Signs a message with a domain private key.

The signed payload is the canonical message without the `signature` field.

### `RouteAuthorizer`

Checks that a requested route is declared by the manifest.

Routes may contain placeholders such as `:userId`, but the gateway must bind them to the authenticated user before subscribing or publishing.

### `ActionReceiver`

Validates actions returned from clients.

It rejects:

- malformed actions;
- cross-domain actions;
- actions without a user gesture;
- `open_url` actions that do not target the same HTTPS domain.

## SDK Availability

The Gateway SDK profile is available in the official SDKs:

| SDK | Signing path used by profile tests |
| --- | --- |
| TypeScript | Ed25519 |
| Python | Ed25519 through the `crypto` extra |
| Go | Ed25519 |
| Rust | Ed25519 |
| Java | Ed25519 |
| C# | ECDSA P-256 until Ed25519 support is completed |

## Reference Gateway

`reference/gateway` uses the Gateway SDK profile with an SSE client transport and two broker adapters:

- in-memory broker for local demos without infrastructure;
- RabbitMQ broker enabled with `AMQP_URL`.

The RabbitMQ integration test covers the real path from gateway publish, to RabbitMQ exchange routing, to SSE delivery of a signed message.

## Production Requirements

Before a domain gateway is production-ready, it must add:

- user authentication;
- per-user route authorization;
- persistent signing keys and key rotation;
- replay protection based on `message.id` and `expiresAt`;
- audit logging for published messages and accepted actions;
- unsubscribe/revocation handling;
- broker-specific retry, dead-letter, and poison-message policy.
