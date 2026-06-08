# Thunderbird Integration

The Thunderbird integration should be implemented as an extension that adds Realtime Mail as an additional account-like source.

## Responsibilities

- Read traditional Thunderbird accounts without replacing them.
- Discover Realtime Mail manifests for domains seen in traditional messages.
- Display trusted realtime messages in a sandboxed reader.
- Keep actions host-mediated and user-confirmed when needed.
- Store trust decisions per domain.

## Suggested extension modules

- `manifest-resolver`: fetches and validates `/.well-known/realtime-mail.json`.
- `trust-policy`: stores approved domains and capabilities.
- `gateway-client`: connects to the realtime gateway.
- `message-bridge`: converts realtime messages into Thunderbird-visible message summaries.
- `sandbox-reader`: renders interactive content in an isolated web extension surface.
