import { webcrypto } from "node:crypto";
import {
  HostActionBroker,
  MessageSigner,
  PaymentRequestPayloadValidator,
  PaymentRequestSecurityPolicy,
  RealtimeMessageBuilder,
  SignatureVerifier,
  TrustPolicy
} from "../packages/typescript/dist/index.js";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

const validNow = new Date("2026-06-08T08:01:00.000Z");
const expiredNow = new Date("2026-06-08T08:16:00.000Z");
const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKey = `ed25519:${Buffer.from(await webcrypto.subtle.exportKey("raw", keyPair.publicKey)).toString("base64url")}`;
const manifest = {
  protocol: "realtime-mail",
  version: "0.1-draft",
  domain: "billing.acme.tld",
  displayName: "ACME Billing",
  publicKeys: [publicKey],
  channels: [{
    id: "invoice-events",
    label: "Invoices",
    route: "/rt/invoices/:userId",
    capabilities: ["render:html", "render:css", "run:script-sandboxed", "payment-request:user-gesture"]
  }]
};

const verifier = new SignatureVerifier(webcrypto);
const signer = new MessageSigner(verifier);
const builder = new RealtimeMessageBuilder(manifest, () => new Date("2026-06-08T08:00:00.000Z"));
const unsigned = builder.build({
  id: "invoice-payment-001",
  channelId: "invoice-events",
  from: "billing@acme.tld",
  subject: "Invoice payment",
  html: "<button>Pay invoice</button>",
  expiresAt: new Date("2026-06-08T08:15:00.000Z")
});
const message = await signer.signEd25519(unsigned, keyPair.privateKey);
const unsignedWithoutPaymentCapability = builder.build({
  id: "invoice-payment-no-capability",
  channelId: "invoice-events",
  from: "billing@acme.tld",
  subject: "Invoice payment without capability",
  html: "<button>Pay invoice</button>",
  capabilities: ["render:html", "render:css", "run:script-sandboxed"],
  expiresAt: new Date("2026-06-08T08:15:00.000Z")
});
const messageWithoutPaymentCapability = await signer.signEd25519(unsignedWithoutPaymentCapability, keyPair.privateKey);
const trust = new TrustPolicy();
trust.trustDomain("billing.acme.tld");
const broker = new HostActionBroker(trust, verifier);

const basePaymentPayload = {
  kind: "host-mediated-payment-request",
  invoiceId: "2026-0608",
  merchant: {
    domain: "billing.acme.tld",
    displayName: "ACME Billing"
  },
  amount: {
    value: "184.90",
    currency: "EUR"
  },
  description: "Invoice #2026-0608",
  confirmationUx: "qr_code",
  fallbackProvider: {
    type: "qr_code",
    label: "Scan to pay",
    qrPayload: "https://billing.acme.tld/pay/invoices/2026-0608?amount=184.90&currency=EUR"
  },
  expiresAt: "2026-06-08T08:15:00.000Z"
};

const baseAction = {
  id: "pay-invoice",
  messageId: message.id,
  domain: message.domain,
  type: "publish_gateway_event",
  requiresUserGesture: true,
  payload: basePaymentPayload
};

await expectPaymentDecision("valid payment request", true, undefined, authorizePayment({}));
await expectPaymentDecision("payment without capability", false, "capability_required", authorizePayment({
  action: {
    ...baseAction,
    messageId: messageWithoutPaymentCapability.id
  },
  message: messageWithoutPaymentCapability
}));
await expectPaymentDecision("modified amount payload", false, "amount_mismatch", authorizePayment({
  action: withPayload({ amount: { value: "999.99", currency: "EUR" } })
}));
await expectPaymentDecision("different merchant domain", false, "invalid_action", authorizePayment({
  action: withPayload({ merchant: { domain: "payments.evil.example", displayName: "ACME Billing" } })
}));
await expectPaymentDecision("expired message", false, "message_expired", authorizePayment({ now: expiredNow }));
await expectPaymentDecision("action from another iframe", false, "untrusted_frame_source", authorizePayment({
  sourceMatchesSelectedSandbox: false
}));
await expectPaymentDecision("double payment invoice id", false, "duplicate_invoice", authorizePayment({
  processedInvoiceIds: ["2026-0608"]
}));

const externalQrPayload = {
  ...basePaymentPayload,
  fallbackProvider: {
    ...basePaymentPayload.fallbackProvider,
    qrPayload: "https://payments.evil.example/pay/invoices/2026-0608"
  }
};
const qrIssues = PaymentRequestPayloadValidator.validate(externalQrPayload);
if (!qrIssues.some((issue) => issue.path === "$.fallbackProvider.qrPayload")) {
  fail(`external QR payload: expected fallback domain issue, got ${JSON.stringify(qrIssues)}`);
}
await expectPaymentDecision("external QR payload action", false, "invalid_action", authorizePayment({
  action: withPayload({ fallbackProvider: externalQrPayload.fallbackProvider })
}));

console.log("PASS payment attack cases");

async function authorizePayment({
  action = baseAction,
  message: candidateMessage = message,
  now = validNow,
  sourceMatchesSelectedSandbox = true,
  processedInvoiceIds = []
}) {
  const brokerDecision = await broker.authorize({
    action,
    message: candidateMessage,
    manifest,
    userGesture: true,
    now
  });
  if (!brokerDecision.ok) {
    return brokerDecision;
  }
  return PaymentRequestSecurityPolicy.authorize({
    action: brokerDecision.action,
    message: candidateMessage,
    manifest,
    sourceMatchesSelectedSandbox,
    expectedInvoiceId: "2026-0608",
    expectedAmount: "184.90",
    expectedCurrency: "EUR",
    processedInvoiceIds,
    now
  });
}

function withPayload(partialPayload) {
  return {
    ...baseAction,
    payload: {
      ...basePaymentPayload,
      ...partialPayload
    }
  };
}

async function expectPaymentDecision(name, expectedOk, expectedReason, decisionPromise) {
  const decision = await decisionPromise;
  if (decision.ok !== expectedOk) {
    fail(`${name}: expected ok=${expectedOk}, got ${JSON.stringify(decision)}`);
  }
  if (expectedReason !== undefined && decision.reason !== expectedReason) {
    fail(`${name}: expected reason=${expectedReason}, got ${JSON.stringify(decision)}`);
  }
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}
