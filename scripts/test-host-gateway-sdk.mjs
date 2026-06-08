import { webcrypto } from "node:crypto";
import {
  ActionReceiver,
  HostActionBroker,
  MessageSigner,
  RealtimeMessageBuilder,
  RouteAuthorizer,
  SignatureVerifier,
  StatePolicy,
  TrustPolicy
} from "../packages/typescript/dist/index.js";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKey = `ed25519:${Buffer.from(await webcrypto.subtle.exportKey("raw", keyPair.publicKey)).toString("base64url")}`;
const manifest = {
  protocol: "realtime-mail",
  version: "0.1-draft",
  domain: "billing.acme.tld",
  displayName: "ACME Billing",
  publicKeys: [publicKey],
  channels: [
    {
      id: "invoice-events",
      label: "Invoices",
      route: "/rt/invoices/:userId",
      capabilities: ["render:html", "render:css", "open-url:user-gesture", "payment-request:user-gesture"]
    }
  ]
};

const verifier = new SignatureVerifier(webcrypto);
const builder = new RealtimeMessageBuilder(manifest, () => new Date("2026-06-08T08:00:00.000Z"));
const signer = new MessageSigner(verifier);
const unsigned = builder.build({
  id: "host-action-001",
  channelId: "invoice-events",
  from: "billing@acme.tld",
  subject: "Action test",
  html: "<a href=\"https://billing.acme.tld/invoices/1\">Open</a>",
  expiresAt: new Date("2026-06-08T08:15:00.000Z")
});
const message = await signer.signEd25519(unsigned, keyPair.privateKey);
const action = {
  id: "open-invoice",
  messageId: message.id,
  domain: message.domain,
  type: "open_url",
  requiresUserGesture: true,
  url: "https://billing.acme.tld/invoices/1"
};
const paymentAction = {
  id: "pay-invoice",
  messageId: message.id,
  domain: message.domain,
  type: "publish_gateway_event",
  requiresUserGesture: true,
  payload: {
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
  }
};

const trust = new TrustPolicy();
trust.trustDomain("billing.acme.tld");
const hostBroker = new HostActionBroker(trust, verifier);

await expectDecision("valid host action", true, hostBroker.authorize({
  action,
  message,
  manifest,
  userGesture: true,
  now: new Date("2026-06-08T08:01:00.000Z")
}));

await expectDecision("missing user gesture", false, hostBroker.authorize({
  action,
  message,
  manifest,
  userGesture: false,
  now: new Date("2026-06-08T08:01:00.000Z")
}));

await expectDecision("expired message", false, hostBroker.authorize({
  action,
  message,
  manifest,
  userGesture: true,
  now: new Date("2026-06-08T08:16:00.000Z")
}));

await expectDecision("valid payment action", true, hostBroker.authorize({
  action: paymentAction,
  message,
  manifest,
  userGesture: true,
  now: new Date("2026-06-08T08:01:00.000Z")
}));

await expectDecision("payment action without capability", false, hostBroker.authorize({
  action: paymentAction,
  message: { ...message, capabilities: message.capabilities.filter((capability) => capability !== "payment-request:user-gesture") },
  manifest,
  userGesture: true,
  now: new Date("2026-06-08T08:01:00.000Z")
}));

const routeAuthorizer = new RouteAuthorizer(manifest);
expectSyncDecision("valid route", true, routeAuthorizer.authorize({
  route: "/rt/invoices/demo-user",
  channelId: "invoice-events",
  userId: "demo-user"
}));
expectSyncDecision("invalid route", false, routeAuthorizer.authorize({
  route: "/rt/admin/demo-user",
  channelId: "invoice-events",
  userId: "demo-user"
}));

const receiver = new ActionReceiver("billing.acme.tld");
expectSyncDecision("valid gateway action", true, receiver.receive(action));
expectSyncDecision("cross-domain gateway action", false, receiver.receive({ ...action, domain: "evil.example", url: "https://evil.example/x" }));

if (StatePolicy.evaluateDomainState("billing.acme.tld", { trustedDomains: ["billing.acme.tld"] }) !== "trusted") {
  fail("trusted domain state");
}
if (StatePolicy.evaluateDomainState("billing.acme.tld", { trustedDomains: ["billing.acme.tld"], mutedDomains: ["billing.acme.tld"] }) !== "muted") {
  fail("muted domain state");
}
if (StatePolicy.evaluateDomainState("billing.acme.tld", { trustedDomains: ["billing.acme.tld"], revokedDomains: ["billing.acme.tld"] }) !== "revoked") {
  fail("revoked domain state");
}
if (StatePolicy.evaluateMessageState(message, { now: new Date("2026-06-08T08:16:00.000Z") }) !== "expired") {
  fail("expired message state");
}
if (StatePolicy.evaluateMessageState(message, {
  deletedMessageIds: [message.id],
  dismissedMessageIds: [message.id],
  now: new Date("2026-06-08T08:16:00.000Z")
}) !== "deleted") {
  fail("deleted message state precedence");
}

console.log("PASS host action broker and gateway SDK security gates");

async function expectDecision(name, expected, decisionPromise) {
  expectSyncDecision(name, expected, await decisionPromise);
}

function expectSyncDecision(name, expected, decision) {
  if (decision.ok !== expected) {
    console.error(`FAIL ${name}: expected ok=${expected}, got ${JSON.stringify(decision)}`);
    process.exit(1);
  }
}

function fail(name) {
  console.error(`FAIL ${name}`);
  process.exit(1);
}
