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

Use the TypeScript, Java, or C# SDK to resolve manifests, apply trust policy, subscribe to channels, and manage traditional mail accounts.

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

The reader should mark the received message as signature verified.
