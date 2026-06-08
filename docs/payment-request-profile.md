# Host-Mediated Payment Request Profile

This profile standardizes payment requests sent from sandboxed enriched realtime messages to the host mail client.

The sandboxed message never initiates payment directly. It may only request a host-mediated action with a payment payload. The host client owns confirmation, Payment Request API usage, provider checkout, QR display, audit logging, and result handling.

## Action Shape

Payment uses the existing host-mediated action envelope:

```json
{
  "id": "pay-invoice",
  "messageId": "invoice-payment-001",
  "domain": "billing.acme.tld",
  "type": "publish_gateway_event",
  "requiresUserGesture": true,
  "payload": {
    "kind": "host-mediated-payment-request"
  }
}
```

The source message must include the `payment-request:user-gesture` capability. Clients must reject payment actions from messages that do not include it.

## Payload

Normative schema: `spec/schemas/payment-request.schema.json`.

Required fields:

- `kind`: must be `host-mediated-payment-request`;
- `invoiceId`: stable invoice identifier shown to the user;
- `merchant.domain`: must match the signed message domain;
- `merchant.displayName`: user-facing merchant name;
- `amount.value`: decimal string with two fractional digits;
- `amount.currency`: ISO 4217 currency code;
- `description`: user-facing payment reason;
- `confirmationUx`: preferred host confirmation mode;
- `expiresAt`: date-time after which the host must reject interactivity.

Optional fields:

- `orderReference`: merchant order reference;
- `fallbackProvider`: provider checkout or QR code fallback.

## Confirmation UX

Supported values:

- `browser_payment_request`: host may try browser Payment Request API;
- `host_confirmation`: host displays its own confirmation UI;
- `provider_checkout`: host opens a trusted provider checkout;
- `qr_code`: host displays or accepts a QR payment fallback.

## QR Payment Fallback

QR fallback is represented as:

```json
{
  "type": "qr_code",
  "label": "Scan to pay",
  "qrPayload": "https://billing.acme.tld/pay/invoices/2026-0608?amount=184.90&currency=EUR"
}
```

The QR payload should be a payment URL or payment-network payload controlled by the merchant or a trusted payment provider. The host may render the QR itself, or the signed message may display a QR for out-of-band mobile payment. In both cases, the host must still verify the payment payload before treating the request as trusted.

## Host Checks

Before acting, the host must verify:

- action envelope validates;
- payment payload validates;
- source message signature verifies;
- source message domain equals merchant domain;
- local domain state is trusted;
- source message contains `payment-request:user-gesture`;
- fresh user gesture is present;
- message and payment request are not expired;
- amount, currency, invoice id, and merchant match the visible confirmation.

## Result Handling

The sandbox may receive a coarse result such as `accepted`, `cancelled`, or `failed`. It must not receive card data, payment credentials, provider tokens, account identifiers, or full receipts.
