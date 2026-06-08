# Reference Gateway

This is a minimal Node.js reference gateway for Realtime Mail.

It exposes Server-Sent Events to clients and can publish through either an in-memory broker or RabbitMQ.

The server uses the TypeScript Gateway SDK profile:

- `RealtimeMessageBuilder` for message construction.
- `MessageSigner` for Ed25519 signatures.
- `RouteAuthorizer` for manifest route checks.
- `ActionReceiver` for host-mediated action validation.

## Run

```bash
npm run build -w @realtimemail/sdk
npm run gateway:start
```

By default the gateway uses the in-memory broker. To use RabbitMQ, set `AMQP_URL`:

```bash
$env:AMQP_URL="amqp://guest:guest@127.0.0.1:5672"
npm run gateway:start
```

The RabbitMQ adapter publishes messages to the `realtime_mail.routes` topic exchange. Routes are encoded into routing keys so exact route subscriptions do not leak raw user route strings into broker topology names.

## Endpoints

- `GET /.well-known/realtime-mail.json`: demo manifest with generated public key.
- `GET /events?route=/rt/invoices/demo-user`: SSE subscription.
- `POST /publish-demo?route=/rt/invoices/demo-user`: publishes a signed demo message.
- `POST /publish-game-demo?route=/rt/invoices/demo-user`: publishes a signed sandboxed mini-game message.
- `POST /publish-payment-demo?route=/rt/invoices/demo-user`: publishes a signed host-mediated payment request message.
- `POST /actions`: validates a host-mediated action request.
- `GET /health`: health check.

`/health` includes the active broker adapter:

```json
{ "ok": true, "broker": "rabbitmq", "subscribers": 1 }
```

## RabbitMQ Integration Test

```bash
$env:AMQP_URL="amqp://guest:guest@127.0.0.1:5672"
npm run rabbitmq:test
```

If RabbitMQ is not reachable, the test is skipped by default. For CI where RabbitMQ is required:

```bash
$env:REQUIRE_RABBITMQ="1"
npm run rabbitmq:test
```

## Production Gaps

- Add real user authentication.
- Persist audit logs.
- Enforce per-user route authorization.
- Use stable domain signing keys instead of ephemeral startup keys.
- Add broker credentials rotation, TLS, and dead-letter handling.
