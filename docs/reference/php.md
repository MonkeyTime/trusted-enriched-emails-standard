# PHP SDK Reference

Package: `realtimemail/realtime-mail`

Path: `packages/php`

Minimum runtime: PHP 7.4.

Required extensions:

- `ext-json`;
- `ext-sodium` for Ed25519 signature verification.

## Constants

- `TrustCapability`
- `MailSource`
- `TrustedDomainState`
- `MessageLifecycleState`
- `RealtimeMailActionType`

The PHP SDK uses class constants instead of PHP 8.1 enums so PHP 7.4 deployments can adopt it.

## Optional DTOs

- `RealtimeMailChannel::fromArray($value)`
- `RealtimeMailManifest::fromArray($value)`
- `RealtimeMailMessage::fromArray($value)`
- `RealtimeMailAction::fromArray($value)`
- `TraditionalMailAccount`

Each DTO exposes `toArray()` for wire-compatible payloads. The validators remain array-first so existing PHP applications can adopt the SDK without a framework or serializer dependency.

## Validation

- `ManifestValidator::validate($value)`
- `ManifestValidator::parse($value)`
- `MessageValidator::validate($value)`
- `MessageValidator::parse($value)`
- `ActionValidator::validate($value)`
- `ActionValidator::parse($value)`
- `PaymentRequestPayloadValidator::validate($value)`
- `PaymentRequestPayloadValidator::parse($value)`

Validators reject unknown properties and return `ValidationIssue` objects with stable `path` and `message` fields.

## Trust And State

- `TrustPolicy::trustDomain($domain)`
- `TrustPolicy::revokeDomain($domain)`
- `TrustPolicy::isTrusted($domain)`
- `TrustPolicy::canRender($message)`
- `TrustPolicy::canRunScript($message)`
- `StatePolicy::evaluateDomainState($domain, $snapshot)`
- `StatePolicy::evaluateMessageState($message, $snapshot)`

## Signatures

- `SignatureVerifier::canonicalMessage($message)`
- `SignatureVerifier::verifyEd25519($message, $publicKey)`

PHP signature verification uses `sodium_crypto_sign_verify_detached`.

## Host Actions

- `HostActionBroker::authorize($action, $message, $manifest, $userGesture, $now)`

Checks action shape, message id, domain trust, user gesture, expiry, Ed25519 signature, and required capability.

## Payments

- `PaymentRequestSecurityPolicy::authorize($context)`

Checks payment payload, source sandbox match, expected invoice id, amount, currency, merchant domain, expiry, and duplicate invoice ids.

## Gateway Profile

- `RealtimeMessageBuilder::build($input)`
- `RouteAuthorizer::authorize($route, $channelId, $userId)`
- `ActionReceiver::receive($value)`

## Known Limitations

- The first PHP SDK is array-based rather than DTO-based to stay PHP 7.4 friendly.
- Ed25519 verification requires `ext-sodium`.
- `npm.cmd run php:check` runs PHP syntax checks and the shared conformance fixtures when PHP is available. It also detects `C:\php-7.4.x\php.exe` on Windows.
