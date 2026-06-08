# Reference Gateway

This is a minimal Node.js reference gateway for trusted enriched email over Realtime Mail channels.

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

Browser origins are local-only by default. Production-like demos can configure exact allowed origins:

```bash
$env:ALLOWED_ORIGINS="https://client.example,https://admin.example"
npm run gateway:start
```

The RabbitMQ adapter publishes messages to the `realtime_mail.routes` topic exchange. Routes are encoded into routing keys so exact route subscriptions do not leak raw user route strings into broker topology names.

## Endpoints

- `GET /.well-known/realtime-mail.json`: demo manifest with generated public key.
- `GET /events?route=/rt/invoices/demo-user&userId=demo-user`: SSE subscription. The gateway binds the route to the authenticated user id.
- `POST /publish-demo?route=/rt/invoices/demo-user`: publishes a signed demo message.
- `POST /publish-game-demo?route=/rt/invoices/demo-user`: publishes a signed sandboxed mini-game message.
- `POST /publish-payment-demo?route=/rt/invoices/demo-user`: publishes a signed host-mediated payment request message.
- `POST /actions`: validates a host-mediated action request.
- `GET /audit`: returns recent structured audit events.
- `GET /health`: health check.

`/health` includes the active broker adapter and audit event count:

```json
{ "ok": true, "broker": "rabbitmq", "subscribers": 1, "auditEvents": 4 }
```

The reference gateway rejects duplicate message ids and duplicate action ids during the current process lifetime. This is a local replay guard for the reference implementation; production deployments should back it with durable storage.

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
- Use stable domain signing keys instead of ephemeral startup keys.
- Add broker credentials rotation, TLS, and dead-letter handling.
