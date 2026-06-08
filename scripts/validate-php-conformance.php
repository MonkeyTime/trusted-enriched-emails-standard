<?php

declare(strict_types=1);

require __DIR__ . '/../packages/php/src/RealtimeMail.php';

use RealtimeMail\ActionValidator;
use RealtimeMail\ManifestValidator;
use RealtimeMail\MessageValidator;
use RealtimeMail\PaymentRequestPayloadValidator;
use RealtimeMail\RealtimeMailAction;
use RealtimeMail\RealtimeMailManifest;
use RealtimeMail\RealtimeMailMessage;
use RealtimeMail\ValidationError;

$root = dirname(__DIR__);

$cases = [
    ['conformance/valid-manifest.acme.json', ManifestValidator::class, true],
    ['conformance/invalid-manifest.missing-keys.json', ManifestValidator::class, false],
    ['conformance/invalid-manifest.unknown-channel-property.json', ManifestValidator::class, false],
    ['conformance/valid-message.invoice.json', MessageValidator::class, true],
    ['conformance/invalid-message.script-without-capability.json', MessageValidator::class, false],
    ['conformance/invalid-message.unknown-property.json', MessageValidator::class, false],
    ['conformance/valid-action.open-url.json', ActionValidator::class, true],
    ['conformance/valid-action.payment-request.json', ActionValidator::class, true],
    ['conformance/invalid-action.no-user-gesture.json', ActionValidator::class, false],
    ['conformance/invalid-action.cross-domain-url.json', ActionValidator::class, false],
    ['conformance/invalid-action.payment-request.missing-merchant.json', ActionValidator::class, false],
    ['conformance/valid-action.payment-request.json', PaymentRequestPayloadValidator::class, true, 'payload'],
];

$failures = 0;

foreach ($cases as $case) {
    [$file, $validator, $shouldBeValid] = $case;
    $value = json_decode((string) file_get_contents($root . '/' . $file), true);
    if (isset($case[3]) && $case[3] === 'payload') {
        $value = $value['payload'] ?? null;
    }

    try {
        $validator::parse($value);
        if (!$shouldBeValid) {
            echo "FAIL {$file}: expected validation failure\n";
            $failures += 1;
        } else {
            echo "PASS {$file}\n";
        }
    } catch (ValidationError $error) {
        if ($shouldBeValid) {
            echo "FAIL {$file}: {$error->getMessage()}\n";
            $failures += 1;
        } else {
            echo "PASS {$file}\n";
        }
    } catch (Throwable $error) {
        echo "FAIL {$file}: {$error->getMessage()}\n";
        $failures += 1;
    }
}

try {
    RealtimeMailManifest::fromArray(json_decode((string) file_get_contents($root . '/conformance/valid-manifest.acme.json'), true));
    RealtimeMailMessage::fromArray(json_decode((string) file_get_contents($root . '/conformance/valid-message.invoice.json'), true));
    RealtimeMailAction::fromArray(json_decode((string) file_get_contents($root . '/conformance/valid-action.open-url.json'), true));
    echo "PASS PHP DTO conversions\n";
} catch (Throwable $error) {
    echo "FAIL PHP DTO conversions: {$error->getMessage()}\n";
    $failures += 1;
}

exit($failures > 0 ? 1 : 0);
