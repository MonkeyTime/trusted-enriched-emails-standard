# Developer Quickstart

## 1. Publish a manifest

Create `/.well-known/realtime-mail.json` on your domain. See `examples/manifests/acme.realtime-mail.json`.

## 2. Sign messages

Each realtime message should be signed by a key listed in the manifest.

## 3. Expose a gateway

Your gateway should translate client subscriptions into broker subscriptions. RabbitMQ, Kafka, Redis Streams, NATS, or provider events can sit behind the gateway.

## 4. Keep fallback email

Send a normal email fallback for clients that do not support Realtime Mail.

## 5. Use an SDK

Use an official SDK to validate manifests, validate messages, verify signatures, apply trust policy, authorize host actions, and authorize payment requests.

Official SDKs currently cover TypeScript, Python, Go, Rust, Java, and C#.

## 6. Run the reference gateway

```bash
npm.cmd run gateway:start
```

Then subscribe to:

```txt
http://127.0.0.1:8787/events?route=/rt/invoices/demo-user
```

And publish a signed demo message:

```txt
POST http://127.0.0.1:8787/publish-demo?route=/rt/invoices/demo-user
```

## 7. Verify in the web client

Start the web client:

```bash
npm.cmd run dev
```

Use the gateway controls in the sidebar:

- `Connect` loads the manifest and opens the SSE subscription.
- `Signed event` asks the gateway to publish a signed message.
- `Mini game` asks the gateway to publish a signed interactive sandbox message.
- `Payment` asks the gateway to publish a signed host-mediated payment request.

The reader should mark the received message as signature verified.

## 8. Know the POC boundary

The POC proves the trust model and SDK surface. It is not a production gateway or a production mail client yet.

Before production, add durable authentication, persistent signing keys, durable audit logs, durable replay protection, rate limits, and broker hardening.

See `docs/poc-completion.md` and `docs/sdk-release-checklist.md`.
