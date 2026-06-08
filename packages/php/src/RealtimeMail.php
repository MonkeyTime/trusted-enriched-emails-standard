<?php

declare(strict_types=1);

namespace RealtimeMail;

final class TrustCapability
{
    public const RENDER_HTML = 'render:html';
    public const RENDER_CSS = 'render:css';
    public const RENDER_SVG = 'render:svg';
    public const RUN_SCRIPT_SANDBOXED = 'run:script-sandboxed';
    public const OPEN_URL_USER_GESTURE = 'open-url:user-gesture';
    public const PAYMENT_REQUEST_USER_GESTURE = 'payment-request:user-gesture';
    public const STORAGE_ISOLATED = 'storage:isolated';
    public const NETWORK_DOMAIN_ONLY = 'network:domain-only';

    public static function all(): array
    {
        return [
            self::RENDER_HTML,
            self::RENDER_CSS,
            self::RENDER_SVG,
            self::RUN_SCRIPT_SANDBOXED,
            self::OPEN_URL_USER_GESTURE,
            self::PAYMENT_REQUEST_USER_GESTURE,
            self::STORAGE_ISOLATED,
            self::NETWORK_DOMAIN_ONLY,
        ];
    }
}

final class MailSource
{
    public const TRADITIONAL = 'traditional';
    public const REALTIME = 'realtime';
}

final class TrustedDomainState
{
    public const TRUSTED = 'trusted';
    public const MUTED = 'muted';
    public const REVOKED = 'revoked';
}

final class MessageLifecycleState
{
    public const VISIBLE = 'visible';
    public const DISMISSED = 'dismissed';
    public const DELETED = 'deleted';
    public const SUPERSEDED = 'superseded';
    public const EXPIRED = 'expired';
}

final class RealtimeMailActionType
{
    public const OPEN_URL = 'open_url';
    public const PUBLISH_GATEWAY_EVENT = 'publish_gateway_event';
    public const REQUEST_NOTIFICATION = 'request_notification';
    public const STORE_ISOLATED_VALUE = 'store_isolated_value';

    public static function all(): array
    {
        return [
            self::OPEN_URL,
            self::PUBLISH_GATEWAY_EVENT,
            self::REQUEST_NOTIFICATION,
            self::STORE_ISOLATED_VALUE,
        ];
    }
}

final class ValidationIssue
{
    public string $path;
    public string $message;

    public function __construct(string $path, string $message)
    {
        $this->path = $path;
        $this->message = $message;
    }
}

final class ValidationError extends \InvalidArgumentException
{
    /** @var ValidationIssue[] */
    public array $issues;

    public function __construct(array $issues)
    {
        $this->issues = $issues;
        parent::__construct(implode('; ', array_map(static function (ValidationIssue $issue): string {
            return $issue->path . ': ' . $issue->message;
        }, $issues)));
    }
}

final class ManifestValidator
{
    public static function validate($value): array
    {
        $issues = [];
        if (!is_array($value)) {
            return [new ValidationIssue('$', 'must be an object')];
        }
        Validators::knownProperties($value, '$', ['protocol', 'version', 'domain', 'displayName', 'publicKeys', 'channels'], $issues);
        if (($value['protocol'] ?? null) !== 'realtime-mail') {
            $issues[] = new ValidationIssue('$.protocol', 'must equal realtime-mail');
        }
        Validators::string($value['version'] ?? null, '$.version', $issues);
        Validators::domain($value['domain'] ?? null, '$.domain', $issues);
        Validators::string($value['displayName'] ?? null, '$.displayName', $issues);
        Validators::stringArray($value['publicKeys'] ?? null, '$.publicKeys', '/^(ed25519|ecdsa-p256):[A-Za-z0-9_-]+={0,2}$/', $issues);
        if (!isset($value['channels']) || !is_array($value['channels']) || count($value['channels']) === 0) {
            $issues[] = new ValidationIssue('$.channels', 'must be a non-empty array');
        } else {
            foreach ($value['channels'] as $index => $channel) {
                Validators::channel($channel, '$.channels[' . $index . ']', $issues);
            }
        }
        return $issues;
    }

    public static function parse($value): array
    {
        $issues = self::validate($value);
        if ($issues) {
            throw new ValidationError($issues);
        }
        return $value;
    }
}

final class MessageValidator
{
    public static function validate($value): array
    {
        $issues = [];
        if (!is_array($value)) {
            return [new ValidationIssue('$', 'must be an object')];
        }
        Validators::knownProperties($value, '$', ['id', 'source', 'domain', 'channelId', 'from', 'subject', 'html', 'css', 'script', 'capabilities', 'receivedAt', 'expiresAt', 'signature'], $issues);
        Validators::string($value['id'] ?? null, '$.id', $issues);
        if (!in_array($value['source'] ?? null, [MailSource::TRADITIONAL, MailSource::REALTIME], true)) {
            $issues[] = new ValidationIssue('$.source', 'must be traditional or realtime');
        }
        Validators::domain($value['domain'] ?? null, '$.domain', $issues);
        Validators::string($value['from'] ?? null, '$.from', $issues);
        Validators::string($value['subject'] ?? null, '$.subject', $issues, true);
        Validators::string($value['html'] ?? null, '$.html', $issues);
        Validators::capabilities($value['capabilities'] ?? null, '$.capabilities', $issues);
        Validators::string($value['receivedAt'] ?? null, '$.receivedAt', $issues);
        if (array_key_exists('expiresAt', $value) && $value['expiresAt'] !== null) {
            Validators::string($value['expiresAt'], '$.expiresAt', $issues);
        }
        if (($value['source'] ?? null) === MailSource::REALTIME) {
            Validators::string($value['channelId'] ?? null, '$.channelId', $issues);
            Validators::string($value['signature'] ?? null, '$.signature', $issues);
        }
        if (($value['script'] ?? null) !== null && !in_array(TrustCapability::RUN_SCRIPT_SANDBOXED, $value['capabilities'] ?? [], true)) {
            $issues[] = new ValidationIssue('$.capabilities', 'must include run:script-sandboxed when script is present');
        }
        return $issues;
    }

    public static function parse($value): array
    {
        $issues = self::validate($value);
        if ($issues) {
            throw new ValidationError($issues);
        }
        return $value;
    }
}

final class ActionValidator
{
    public static function validate($value): array
    {
        $issues = [];
        if (!is_array($value)) {
            return [new ValidationIssue('$', 'must be an object')];
        }
        Validators::knownProperties($value, '$', ['id', 'messageId', 'domain', 'type', 'requiresUserGesture', 'url', 'payload'], $issues);
        if (!is_string($value['id'] ?? null) || !preg_match('/^[a-z0-9][a-z0-9._-]{0,63}$/', $value['id'])) {
            $issues[] = new ValidationIssue('$.id', 'must be a valid action id');
        }
        Validators::string($value['messageId'] ?? null, '$.messageId', $issues);
        Validators::domain($value['domain'] ?? null, '$.domain', $issues);
        if (!in_array($value['type'] ?? null, RealtimeMailActionType::all(), true)) {
            $issues[] = new ValidationIssue('$.type', 'must be a supported action type');
        }
        if (($value['requiresUserGesture'] ?? null) !== true) {
            $issues[] = new ValidationIssue('$.requiresUserGesture', 'must be true');
        }
        if (($value['type'] ?? null) === RealtimeMailActionType::OPEN_URL) {
            $host = parse_url((string) ($value['url'] ?? ''), PHP_URL_HOST);
            $scheme = parse_url((string) ($value['url'] ?? ''), PHP_URL_SCHEME);
            if ($scheme !== 'https' || $host !== ($value['domain'] ?? null)) {
                $issues[] = new ValidationIssue('$.url', 'must be an https URL for the action domain');
            }
        }
        $payload = $value['payload'] ?? null;
        if (is_array($payload) && ($payload['kind'] ?? null) === 'host-mediated-payment-request') {
            foreach (PaymentRequestPayloadValidator::validate($payload) as $issue) {
                $issues[] = new ValidationIssue('$.payload' . substr($issue->path, 1), $issue->message);
            }
            if (($value['type'] ?? null) !== RealtimeMailActionType::PUBLISH_GATEWAY_EVENT) {
                $issues[] = new ValidationIssue('$.type', 'must be publish_gateway_event for payment requests');
            }
            if (($payload['merchant']['domain'] ?? null) !== ($value['domain'] ?? null)) {
                $issues[] = new ValidationIssue('$.payload.merchant.domain', 'must match action domain');
            }
        }
        return $issues;
    }

    public static function parse($value): array
    {
        $issues = self::validate($value);
        if ($issues) {
            throw new ValidationError($issues);
        }
        return $value;
    }
}

final class PaymentRequestPayloadValidator
{
    public static function validate($value): array
    {
        $issues = [];
        if (!is_array($value)) {
            return [new ValidationIssue('$', 'must be an object')];
        }
        Validators::knownProperties($value, '$', ['kind', 'invoiceId', 'merchant', 'amount', 'description', 'orderReference', 'confirmationUx', 'fallbackProvider', 'expiresAt'], $issues);
        if (($value['kind'] ?? null) !== 'host-mediated-payment-request') {
            $issues[] = new ValidationIssue('$.kind', 'must equal host-mediated-payment-request');
        }
        Validators::string($value['invoiceId'] ?? null, '$.invoiceId', $issues);
        Validators::paymentMerchant($value['merchant'] ?? null, '$.merchant', $issues);
        Validators::paymentAmount($value['amount'] ?? null, '$.amount', $issues);
        Validators::string($value['description'] ?? null, '$.description', $issues);
        if (array_key_exists('orderReference', $value) && $value['orderReference'] !== null) {
            Validators::string($value['orderReference'], '$.orderReference', $issues);
        }
        if (!in_array($value['confirmationUx'] ?? null, ['browser_payment_request', 'host_confirmation', 'provider_checkout', 'qr_code'], true)) {
            $issues[] = new ValidationIssue('$.confirmationUx', 'must be a supported confirmation UX');
        }
        if (array_key_exists('fallbackProvider', $value) && $value['fallbackProvider'] !== null) {
            Validators::paymentFallback($value['fallbackProvider'], '$.fallbackProvider', $issues);
        }
        if (is_array($value['merchant'] ?? null) && is_array($value['fallbackProvider'] ?? null)) {
            Validators::validateFallbackDomain($value['fallbackProvider'], (string) ($value['merchant']['domain'] ?? ''), '$.fallbackProvider', $issues);
        }
        Validators::string($value['expiresAt'] ?? null, '$.expiresAt', $issues);
        return $issues;
    }

    public static function parse($value): array
    {
        $issues = self::validate($value);
        if ($issues) {
            throw new ValidationError($issues);
        }
        return $value;
    }
}

final class TrustPolicy
{
    private array $trustedDomains = [];

    public function trustDomain(string $domain): void
    {
        $this->trustedDomains[$domain] = true;
    }

    public function revokeDomain(string $domain): void
    {
        unset($this->trustedDomains[$domain]);
    }

    public function isTrusted(string $domain): bool
    {
        return isset($this->trustedDomains[$domain]);
    }

    public function canRender(array $message): bool
    {
        if (($message['source'] ?? null) === MailSource::TRADITIONAL) {
            return in_array(TrustCapability::RENDER_HTML, $message['capabilities'] ?? [], true);
        }
        return $this->isTrusted((string) ($message['domain'] ?? '')) && in_array(TrustCapability::RENDER_HTML, $message['capabilities'] ?? [], true);
    }

    public function canRunScript(array $message): bool
    {
        return ($message['source'] ?? null) === MailSource::REALTIME
            && $this->isTrusted((string) ($message['domain'] ?? ''))
            && in_array(TrustCapability::RUN_SCRIPT_SANDBOXED, $message['capabilities'] ?? [], true);
    }
}

final class StatePolicy
{
    public static function evaluateDomainState(string $domain, array $snapshot): string
    {
        if (in_array($domain, $snapshot['revokedDomains'] ?? [], true)) {
            return TrustedDomainState::REVOKED;
        }
        if (in_array($domain, $snapshot['mutedDomains'] ?? [], true)) {
            return TrustedDomainState::MUTED;
        }
        if (in_array($domain, $snapshot['trustedDomains'] ?? [], true)) {
            return TrustedDomainState::TRUSTED;
        }
        return TrustedDomainState::REVOKED;
    }

    public static function evaluateMessageState(array $message, array $snapshot = []): string
    {
        if (in_array($message['id'] ?? '', $snapshot['deletedMessageIds'] ?? [], true)) {
            return MessageLifecycleState::DELETED;
        }
        if (in_array($message['id'] ?? '', $snapshot['supersededMessageIds'] ?? [], true)) {
            return MessageLifecycleState::SUPERSEDED;
        }
        $now = new \DateTimeImmutable($snapshot['now'] ?? 'now');
        if (isset($message['expiresAt']) && new \DateTimeImmutable($message['expiresAt']) <= $now) {
            return MessageLifecycleState::EXPIRED;
        }
        if (in_array($message['id'] ?? '', $snapshot['dismissedMessageIds'] ?? [], true)) {
            return MessageLifecycleState::DISMISSED;
        }
        return MessageLifecycleState::VISIBLE;
    }
}

final class SignatureVerifier
{
    public function canonicalMessage(array $message): string
    {
        $value = $message;
        unset($value['signature']);
        $value = array_filter($value, static function ($item): bool {
            return $item !== null;
        });
        ksort($value);
        return self::canonicalJson($value);
    }

    public function verifyEd25519(array $message, string $publicKey): bool
    {
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            return false;
        }
        if (!isset($message['signature']) || strpos($publicKey, 'ed25519:') !== 0) {
            return false;
        }
        try {
            $keyBytes = self::base64UrlDecode(substr($publicKey, strlen('ed25519:')));
            $signature = self::signatureBytes((string) $message['signature']);
            return sodium_crypto_sign_verify_detached($signature, $this->canonicalMessage($message), $keyBytes);
        } catch (\Throwable $error) {
            return false;
        }
    }

    public static function canonicalJson($value): string
    {
        if (is_array($value)) {
            if (array_keys($value) === range(0, count($value) - 1)) {
                return '[' . implode(',', array_map([self::class, 'canonicalJson'], $value)) . ']';
            }
            ksort($value);
            $parts = [];
            foreach ($value as $key => $item) {
                if ($item !== null) {
                    $parts[] = json_encode((string) $key, JSON_UNESCAPED_SLASHES) . ':' . self::canonicalJson($item);
                }
            }
            return '{' . implode(',', $parts) . '}';
        }
        return json_encode($value, JSON_UNESCAPED_SLASHES);
    }

    public static function signatureBytes(string $signature): string
    {
        if (strpos($signature, 'rmail1.') === 0) {
            $parts = explode('.', $signature);
            return self::base64UrlDecode($parts[2] ?? '');
        }
        if (strpos($signature, 'ed25519:') === 0) {
            return self::base64UrlDecode(substr($signature, strlen('ed25519:')));
        }
        return self::base64UrlDecode($signature);
    }

    public static function base64UrlDecode(string $value): string
    {
        $base64 = strtr($value, '-_', '+/');
        $base64 .= str_repeat('=', (4 - strlen($base64) % 4) % 4);
        $decoded = base64_decode($base64, true);
        if ($decoded === false) {
            throw new \InvalidArgumentException('Invalid base64url value');
        }
        return $decoded;
    }
}

final class HostActionBroker
{
    private TrustPolicy $trustPolicy;
    private SignatureVerifier $verifier;

    public function __construct(TrustPolicy $trustPolicy, ?SignatureVerifier $verifier = null)
    {
        $this->trustPolicy = $trustPolicy;
        $this->verifier = $verifier ?? new SignatureVerifier();
    }

    public function authorize($actionValue, array $message, array $manifest, bool $userGesture, ?\DateTimeImmutable $now = null): array
    {
        if (ActionValidator::validate($actionValue)) {
            return ['ok' => false, 'reason' => 'invalid_action'];
        }
        $action = $actionValue;
        if (($action['messageId'] ?? null) !== ($message['id'] ?? null)) {
            return ['ok' => false, 'reason' => 'message_mismatch'];
        }
        if (($action['domain'] ?? null) !== ($message['domain'] ?? null) || ($action['domain'] ?? null) !== ($manifest['domain'] ?? null)) {
            return ['ok' => false, 'reason' => 'domain_mismatch'];
        }
        if (!$this->trustPolicy->isTrusted((string) $action['domain'])) {
            return ['ok' => false, 'reason' => 'domain_not_trusted'];
        }
        if (!$userGesture || ($action['requiresUserGesture'] ?? null) !== true) {
            return ['ok' => false, 'reason' => 'user_gesture_required'];
        }
        if (isset($message['expiresAt']) && new \DateTimeImmutable($message['expiresAt']) <= ($now ?? new \DateTimeImmutable('now'))) {
            return ['ok' => false, 'reason' => 'message_expired'];
        }
        $verified = false;
        foreach ($manifest['publicKeys'] ?? [] as $key) {
            if (is_string($key) && strpos($key, 'ed25519:') === 0 && $this->verifier->verifyEd25519($message, $key)) {
                $verified = true;
                break;
            }
        }
        if (!$verified) {
            return ['ok' => false, 'reason' => 'signature_required'];
        }
        if (($action['type'] ?? null) === RealtimeMailActionType::OPEN_URL && !in_array(TrustCapability::OPEN_URL_USER_GESTURE, $message['capabilities'] ?? [], true)) {
            return ['ok' => false, 'reason' => 'capability_required'];
        }
        if (self::isPaymentRequest($action['payload'] ?? null) && !in_array(TrustCapability::PAYMENT_REQUEST_USER_GESTURE, $message['capabilities'] ?? [], true)) {
            return ['ok' => false, 'reason' => 'capability_required'];
        }
        return ['ok' => true, 'reason' => 'ok', 'action' => $action];
    }

    private static function isPaymentRequest($payload): bool
    {
        return is_array($payload) && ($payload['kind'] ?? null) === 'host-mediated-payment-request';
    }
}

final class PaymentRequestSecurityPolicy
{
    public static function authorize(array $context): array
    {
        $action = $context['action'] ?? null;
        $message = $context['message'] ?? null;
        $manifest = $context['manifest'] ?? null;
        if (($context['sourceMatchesSelectedSandbox'] ?? false) !== true) {
            return ['ok' => false, 'reason' => 'untrusted_frame_source'];
        }
        if (!is_array($action) || !is_array($message) || !is_array($manifest)) {
            return ['ok' => false, 'reason' => 'invalid_context'];
        }
        if (($action['type'] ?? null) !== RealtimeMailActionType::PUBLISH_GATEWAY_EVENT || !is_array($action['payload'] ?? null)) {
            return ['ok' => false, 'reason' => 'payment_payload_required'];
        }
        if (PaymentRequestPayloadValidator::validate($action['payload'])) {
            return ['ok' => false, 'reason' => 'invalid_payment_payload'];
        }
        $payload = $action['payload'];
        if (($action['messageId'] ?? null) !== ($message['id'] ?? null)) {
            return ['ok' => false, 'reason' => 'message_mismatch'];
        }
        if (($action['domain'] ?? null) !== ($message['domain'] ?? null) || ($action['domain'] ?? null) !== ($manifest['domain'] ?? null)) {
            return ['ok' => false, 'reason' => 'domain_mismatch'];
        }
        if (($payload['merchant']['domain'] ?? null) !== ($message['domain'] ?? null)) {
            return ['ok' => false, 'reason' => 'merchant_domain_mismatch'];
        }
        if (!in_array(TrustCapability::PAYMENT_REQUEST_USER_GESTURE, $message['capabilities'] ?? [], true)) {
            return ['ok' => false, 'reason' => 'capability_required'];
        }
        if (isset($context['expectedInvoiceId']) && $payload['invoiceId'] !== $context['expectedInvoiceId']) {
            return ['ok' => false, 'reason' => 'invoice_mismatch'];
        }
        if (isset($context['expectedAmount']) && ($payload['amount']['value'] ?? null) !== $context['expectedAmount']) {
            return ['ok' => false, 'reason' => 'amount_mismatch'];
        }
        if (isset($context['expectedCurrency']) && ($payload['amount']['currency'] ?? null) !== $context['expectedCurrency']) {
            return ['ok' => false, 'reason' => 'currency_mismatch'];
        }
        if (new \DateTimeImmutable($payload['expiresAt']) <= ($context['now'] ?? new \DateTimeImmutable('now'))) {
            return ['ok' => false, 'reason' => 'payment_expired'];
        }
        if (in_array($payload['invoiceId'], $context['processedInvoiceIds'] ?? [], true)) {
            return ['ok' => false, 'reason' => 'duplicate_invoice'];
        }
        return ['ok' => true, 'reason' => 'ok', 'payload' => $payload];
    }
}

final class RealtimeMessageBuilder
{
    private array $manifest;

    public function __construct(array $manifest)
    {
        $this->manifest = ManifestValidator::parse($manifest);
    }

    public function build(array $input): array
    {
        $channel = null;
        foreach ($this->manifest['channels'] as $candidate) {
            if (($candidate['id'] ?? null) === ($input['channelId'] ?? null)) {
                $channel = $candidate;
                break;
            }
        }
        if ($channel === null) {
            throw new \InvalidArgumentException('Unknown channel: ' . (string) ($input['channelId'] ?? ''));
        }
        $message = [
            'id' => $input['id'] ?? self::uuidV4(),
            'source' => MailSource::REALTIME,
            'domain' => $this->manifest['domain'],
            'channelId' => $channel['id'],
            'from' => $input['from'] ?? $input['fromAddress'] ?? '',
            'subject' => $input['subject'] ?? '',
            'html' => $input['html'] ?? '',
            'css' => $input['css'] ?? null,
            'script' => $input['script'] ?? null,
            'capabilities' => $input['capabilities'] ?? $channel['capabilities'],
            'receivedAt' => $input['receivedAt'] ?? gmdate('Y-m-d\TH:i:s\Z'),
            'expiresAt' => $input['expiresAt'] ?? null,
        ];
        $wire = array_filter($message, static function ($item): bool {
            return $item !== null;
        });
        MessageValidator::parse($wire + ['signature' => 'unsigned-builder-placeholder']);
        return $wire;
    }

    private static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

final class RouteAuthorizer
{
    private array $manifest;

    public function __construct(array $manifest)
    {
        $this->manifest = ManifestValidator::parse($manifest);
    }

    public function authorize(string $route, ?string $channelId = null, ?string $userId = null): array
    {
        foreach ($this->manifest['channels'] as $channel) {
            if ($channelId !== null && ($channel['id'] ?? null) !== $channelId) {
                continue;
            }
            if (self::routeMatches((string) $channel['route'], $route, $userId)) {
                return ['ok' => true, 'reason' => 'ok', 'channel' => $channel];
            }
        }
        return ['ok' => false, 'reason' => 'route_not_allowed'];
    }

    private static function routeMatches(string $pattern, string $route, ?string $userId): bool
    {
        $patternParts = array_values(array_filter(explode('/', $pattern), 'strlen'));
        $routeParts = array_values(array_filter(explode('/', $route), 'strlen'));
        if (count($patternParts) !== count($routeParts)) {
            return false;
        }
        foreach ($patternParts as $index => $part) {
            if ($part === ':userId') {
                if ($userId === null || $routeParts[$index] !== $userId) {
                    return false;
                }
            } elseif (strpos($part, ':') === 0 || $part !== $routeParts[$index]) {
                return false;
            }
        }
        return true;
    }
}

final class ActionReceiver
{
    private string $domain;

    public function __construct(string $domain)
    {
        $this->domain = $domain;
    }

    public function receive($value): array
    {
        if (ActionValidator::validate($value)) {
            return ['ok' => false, 'reason' => 'invalid_action'];
        }
        if (($value['domain'] ?? null) !== $this->domain) {
            return ['ok' => false, 'reason' => 'domain_not_allowed'];
        }
        return ['ok' => true, 'reason' => 'ok', 'action' => $value];
    }
}

final class Validators
{
    public static function string($value, string $path, array &$issues, bool $allowEmpty = false): void
    {
        if (!is_string($value) || (!$allowEmpty && $value === '')) {
            $issues[] = new ValidationIssue($path, 'must be a string');
        }
    }

    public static function domain($value, string $path, array &$issues): void
    {
        if (!is_string($value) || !preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/', $value)) {
            $issues[] = new ValidationIssue($path, 'must be a valid domain');
        }
    }

    public static function stringArray($value, string $path, string $pattern, array &$issues): void
    {
        if (!is_array($value) || count($value) === 0) {
            $issues[] = new ValidationIssue($path, 'must be a non-empty string array');
            return;
        }
        foreach ($value as $index => $item) {
            if (!is_string($item) || !preg_match($pattern, $item)) {
                $issues[] = new ValidationIssue($path . '[' . $index . ']', 'must be a valid string value');
            }
        }
    }

    public static function capabilities($value, string $path, array &$issues): void
    {
        if (!is_array($value)) {
            $issues[] = new ValidationIssue($path, 'must be an array');
            return;
        }
        foreach ($value as $index => $item) {
            if (!in_array($item, TrustCapability::all(), true)) {
                $issues[] = new ValidationIssue($path . '[' . $index . ']', 'must be a supported capability');
            }
        }
    }

    public static function channel($value, string $path, array &$issues): void
    {
        if (!is_array($value)) {
            $issues[] = new ValidationIssue($path, 'must be an object');
            return;
        }
        self::knownProperties($value, $path, ['id', 'label', 'route', 'description', 'capabilities'], $issues);
        if (!is_string($value['id'] ?? null) || !preg_match('/^[a-z0-9][a-z0-9._-]{0,63}$/', $value['id'])) {
            $issues[] = new ValidationIssue($path . '.id', 'must be a valid channel id');
        }
        self::string($value['label'] ?? null, $path . '.label', $issues);
        self::string($value['route'] ?? null, $path . '.route', $issues);
        self::capabilities($value['capabilities'] ?? null, $path . '.capabilities', $issues);
    }

    public static function paymentMerchant($value, string $path, array &$issues): void
    {
        if (!is_array($value)) {
            $issues[] = new ValidationIssue($path, 'must be an object');
            return;
        }
        self::knownProperties($value, $path, ['domain', 'displayName'], $issues);
        self::domain($value['domain'] ?? null, $path . '.domain', $issues);
        self::string($value['displayName'] ?? null, $path . '.displayName', $issues);
    }

    public static function paymentAmount($value, string $path, array &$issues): void
    {
        if (!is_array($value)) {
            $issues[] = new ValidationIssue($path, 'must be an object');
            return;
        }
        self::knownProperties($value, $path, ['value', 'currency'], $issues);
        self::string($value['value'] ?? null, $path . '.value', $issues);
        self::string($value['currency'] ?? null, $path . '.currency', $issues);
    }

    public static function paymentFallback($value, string $path, array &$issues): void
    {
        if (!is_array($value)) {
            $issues[] = new ValidationIssue($path, 'must be an object');
            return;
        }
        self::knownProperties($value, $path, ['type', 'label', 'url', 'qrPayload'], $issues);
        if (!in_array($value['type'] ?? null, ['provider_checkout', 'qr_code'], true)) {
            $issues[] = new ValidationIssue($path . '.type', 'must be a supported fallback provider type');
        }
        self::string($value['label'] ?? null, $path . '.label', $issues);
        if (array_key_exists('url', $value) && $value['url'] !== null) {
            self::string($value['url'], $path . '.url', $issues);
        }
        if (array_key_exists('qrPayload', $value) && $value['qrPayload'] !== null) {
            self::string($value['qrPayload'], $path . '.qrPayload', $issues);
        }
    }

    public static function validateFallbackDomain(array $value, string $merchantDomain, string $path, array &$issues): void
    {
        foreach (['url', 'qrPayload'] as $key) {
            $payload = $value[$key] ?? null;
            if (!is_string($payload) || strpos($payload, 'https://') !== 0) {
                continue;
            }
            if (parse_url($payload, PHP_URL_HOST) !== $merchantDomain) {
                $issues[] = new ValidationIssue($path . '.' . $key, 'must stay on the merchant domain');
            }
        }
    }

    public static function knownProperties(array $value, string $path, array $allowed, array &$issues): void
    {
        foreach ($value as $key => $_) {
            if (!in_array((string) $key, $allowed, true)) {
                $issues[] = new ValidationIssue($path . '.' . $key, 'is not a supported property');
            }
        }
    }
}
