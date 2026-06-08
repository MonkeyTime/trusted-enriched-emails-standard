# SDK Release Checklist

This checklist defines what "SDK complete enough for the POC" means.

## Required SDK Surface

Every official SDK should expose:

- Manifest, message, action, and payment request models.
- Manifest, message, action, and payment request validators.
- Validation errors with stable paths and messages.
- Trust capability constants.
- Trusted domain state evaluation.
- Message lifecycle state evaluation.
- Trust policy helpers.
- Signature canonicalization.
- Signature verification for the language's supported algorithm.
- Host action authorization.
- Payment request security authorization.
- Gateway profile helpers:
  - `RealtimeMessageBuilder`;
  - `MessageSigner`;
  - `RouteAuthorizer`;
  - `ActionReceiver`.

## Required Security Behavior

SDKs must fail closed for:

- unknown or malformed capabilities;
- malformed domains;
- invalid manifest, message, action, or payment payload fields;
- script content without `run:script-sandboxed`;
- host actions without `requiresUserGesture`;
- cross-domain `open_url` actions;
- payment actions without `payment-request:user-gesture`;
- route placeholders other than the standard `:userId`;
- payment payloads with merchant or QR/provider URLs outside the merchant domain;
- duplicate invoice ids when the host provides processed ids.

## Cross-SDK Compatibility Rules

- TypeScript remains the first implementation for new schema fields.
- Every new normative behavior must receive either a shared conformance fixture or a language-native test in the same change.
- Behavior must be deny-by-default when a language cannot support a feature safely.
- Signature canonicalization must be stable across languages.
- Error reason strings for security policies should stay aligned across languages.

## Documentation Requirements

Each SDK reference page should list:

- public models and enums;
- validator classes or functions;
- security policy classes or functions;
- signature support;
- gateway profile helpers;
- known limitations.

The compatibility matrix must be updated whenever a feature moves between `Planned`, `Partial`, and `Yes`.

## Release Gate Commands

Run from the repository root:

```bash
npm.cmd run test
npm.cmd run docs:build
```

For RabbitMQ-required CI:

```bash
$env:AMQP_URL="amqp://guest:guest@127.0.0.1:5672"
$env:REQUIRE_RABBITMQ="1"
npm.cmd run rabbitmq:test
```

## Package Readiness

Before publishing packages:

- Confirm package names and owners.
- Add repository URLs to native package metadata.
- Add license metadata everywhere.
- Add changelog entries.
- Tag a draft release.
- Publish TypeScript first, then use the same version for Python, Go, PHP, Rust, Java, and C#.
