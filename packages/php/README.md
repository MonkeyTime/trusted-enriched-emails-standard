# Realtime Mail PHP SDK

PHP SDK for trusted enriched email over the Realtime Mail draft standard.

The package targets PHP 7.4 and PHP 8.x. It intentionally avoids PHP 8.1-only enums so legacy PHP deployments can adopt the SDK through Composer.

## Requirements

- PHP 7.4 or newer.
- `ext-json`.
- `ext-sodium` for Ed25519 signature verification.

## Surface

- Manifest, message, action, and payment request validators.
- Optional DTOs for manifests, channels, messages, actions, and traditional mail accounts.
- Trust capability constants.
- Trust and state policy helpers.
- Signature canonicalization and Ed25519 verification.
- Host action authorization.
- Payment request security authorization.
- Gateway profile helpers: `RealtimeMessageBuilder`, `RouteAuthorizer`, and `ActionReceiver`.

## Checks

```bash
npm.cmd run php:check
```

The check lints the PHP SDK and runs the shared conformance fixtures. On Windows, the repository check also detects `C:\php-7.4.x\php.exe` when PHP is not on `PATH`.

## Example

```php
use RealtimeMail\ManifestValidator;
use RealtimeMail\PaymentRequestSecurityPolicy;
use RealtimeMail\TrustCapability;

$manifest = ManifestValidator::parse($manifestJson);

$decision = PaymentRequestSecurityPolicy::authorize([
    "action" => $action,
    "message" => $message,
    "manifest" => $manifest,
    "sourceMatchesSelectedSandbox" => true,
    "expectedAmount" => "184.90",
    "expectedCurrency" => "EUR",
    "processedInvoiceIds" => []
]);

if (!$decision["ok"]) {
    throw new RuntimeException($decision["reason"]);
}
```
