import { createServer } from "node:http";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import QRCode from "qrcode";
import { createBrokerFromEnv } from "./broker.mjs";
import {
  ActionReceiver,
  MessageSigner,
  RealtimeMessageBuilder,
  RouteAuthorizer,
  SignatureVerifier
} from "../../../packages/typescript/dist/index.js";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const verifier = new SignatureVerifier(webcrypto);
const port = Number(process.env.PORT ?? 8787);
const broker = await createBrokerFromEnv();
const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKey = `ed25519:${Buffer.from(await webcrypto.subtle.exportKey("raw", keyPair.publicKey)).toString("base64url")}`;

const manifest = {
  ...(JSON.parse(await readFile(join(root, "examples/manifests/acme.realtime-mail.json"), "utf8"))),
  publicKeys: [publicKey]
};
const routeAuthorizer = new RouteAuthorizer(manifest);
const messageBuilder = new RealtimeMessageBuilder(manifest);
const messageSigner = new MessageSigner(verifier);
const actionReceiver = new ActionReceiver(manifest.domain);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (!isAllowedBrowserOrigin(request)) {
    sendJson(request, response, { ok: false, error: "origin_not_allowed" }, 403);
    return;
  }
  if (request.method === "OPTIONS") {
    sendJson(request, response, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/.well-known/realtime-mail.json") {
    sendJson(request, response, manifest);
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(request, response, { ok: true, broker: broker.type, subscribers: broker.subscriberCount });
    return;
  }

  if (request.method === "GET" && url.pathname === "/events") {
    const route = url.searchParams.get("route") ?? "/rt/invoices/demo-user";
    const authorized = routeAuthorizer.authorize({ route, channelId: "invoice-events", userId: "demo-user" });
    if (!authorized.ok) {
      sendJson(request, response, { ok: false, error: authorized.reason }, 403);
      return;
    }
    await subscribeSse(request, route, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/publish-demo") {
    const route = url.searchParams.get("route") ?? "/rt/invoices/demo-user";
    const authorized = routeAuthorizer.authorize({ route, channelId: "invoice-events", userId: "demo-user" });
    if (!authorized.ok) {
      sendJson(request, response, { ok: false, error: authorized.reason }, 403);
      return;
    }
    const message = await createSignedMessage(route);
    await broker.publish(route, message);
    sendJson(request, response, { ok: true, route, message });
    return;
  }

  if (request.method === "POST" && url.pathname === "/publish-game-demo") {
    const route = url.searchParams.get("route") ?? "/rt/invoices/demo-user";
    const authorized = routeAuthorizer.authorize({ route, channelId: "invoice-events", userId: "demo-user" });
    if (!authorized.ok) {
      sendJson(request, response, { ok: false, error: authorized.reason }, 403);
      return;
    }
    const message = await createMiniGameMessage(route);
    await broker.publish(route, message);
    sendJson(request, response, { ok: true, route, message });
    return;
  }

  if (request.method === "POST" && url.pathname === "/publish-payment-demo") {
    const route = url.searchParams.get("route") ?? "/rt/invoices/demo-user";
    const authorized = routeAuthorizer.authorize({ route, channelId: "invoice-events", userId: "demo-user" });
    if (!authorized.ok) {
      sendJson(request, response, { ok: false, error: authorized.reason }, 403);
      return;
    }
    const message = await createPaymentMessage(route);
    await broker.publish(route, message);
    sendJson(request, response, { ok: true, route, message });
    return;
  }

  if (request.method === "POST" && url.pathname === "/actions") {
    const action = await readJson(request);
    const result = actionReceiver.receive(action.action ?? action);
    sendJson(request, response, result, result.ok ? 202 : 400);
    return;
  }

  sendJson(request, response, { error: "not_found" }, 404);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Realtime Mail reference gateway listening on http://127.0.0.1:${port}`);
  console.log(`Broker adapter: ${broker.type}`);
  console.log(`Manifest public key: ${publicKey}`);
});

async function subscribeSse(request, route, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...corsHeaders(request)
  });
  const subscription = await broker.subscribe(route, (message) => {
    response.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ route })}\n\n`);
  response.on("close", () => {
    void subscription.unsubscribe();
  });
}

async function createSignedMessage(route) {
  const message = messageBuilder.build({
    from: "billing@acme.tld",
    channelId: "invoice-events",
    subject: "Reference gateway signed event",
    html: "<article><h1>Signed gateway event</h1><p>This message was signed by the reference gateway.</p></article>",
    css: "body { font-family: system-ui, sans-serif; padding: 24px; }",
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 15)
  });
  const signed = await messageSigner.signEd25519(message, keyPair.privateKey);
  return serializeSignedMessage(signed, route);
}

async function createMiniGameMessage(route) {
  const message = messageBuilder.build({
    from: "play@billing.acme.tld",
    channelId: "invoice-events",
    subject: "Invoice Runner mini game",
    html: `
      <main class="game">
        <p class="kicker">ACME Billing Arcade</p>
        <h1>Catch the invoice</h1>
        <p class="score">Score: <strong id="score">0</strong></p>
        <button id="target">Catch</button>
        <p id="state">Press catch before the timer ends.</p>
      </main>
    `,
    css: `
      body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #17211d; background: #f5fbff; }
      .game { min-height: 330px; padding: 24px; position: relative; overflow: hidden; }
      .kicker { color: #155e75; font-size: 12px; font-weight: 900; margin: 0 0 8px; text-transform: uppercase; }
      h1 { font-size: 28px; margin: 0 0 12px; }
      .score { margin: 0 0 16px; }
      #target { border: 0; border-radius: 8px; background: #0f766e; color: white; cursor: pointer; font-weight: 900; height: 48px; min-width: 92px; padding: 0 16px; position: absolute; left: 24px; top: 168px; }
      #state { bottom: 18px; color: #475569; font-weight: 800; left: 24px; margin: 0; position: absolute; }
    `,
    script: `
      const score = document.querySelector("#score");
      const state = document.querySelector("#state");
      const target = document.querySelector("#target");
      let value = 0;
      let active = true;
      function move() {
        target.style.left = Math.round(24 + Math.random() * 280) + "px";
        target.style.top = Math.round(126 + Math.random() * 145) + "px";
      }
      target.addEventListener("click", () => {
        if (!active) return;
        value += 1;
        score.textContent = String(value);
        state.textContent = value >= 5 ? "Win: host action unlocked, but still sandboxed." : "Nice catch.";
        move();
      });
      const timer = setInterval(move, 700);
      setTimeout(() => {
        active = false;
        clearInterval(timer);
        target.disabled = true;
        state.textContent = value >= 5 ? "You won the invoice round." : "Round ended.";
      }, 12000);
    `,
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 15)
  });
  const signed = await messageSigner.signEd25519(message, keyPair.privateKey);
  return serializeSignedMessage(signed, route);
}

async function createPaymentMessage(route) {
  const paymentPayload = createPaymentRequestPayload();
  const qrSvg = await QRCode.toString(paymentPayload.fallbackProvider.qrPayload, {
    type: "svg",
    margin: 1,
    width: 148
  });
  const message = messageBuilder.build({
    from: "billing@acme.tld",
    channelId: "invoice-events",
    subject: "Secure in-client payment request",
    html: `
      <article class="payment">
        <p class="kicker">ACME Billing</p>
        <h1>Invoice payment</h1>
        <p>Amount due: <strong>${paymentPayload.amount.value} ${paymentPayload.amount.currency}</strong></p>
        <p>This email can request payment, but only the trusted host client can open the payment flow.</p>
        <div class="qr">${qrSvg}</div>
        <p class="qrLabel">Fallback: scan this QR code with a trusted banking app.</p>
        <button id="pay">Pay securely</button>
        <p id="result"></p>
      </article>
    `,
    css: `
      body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #17211d; background: #fbfbf7; }
      .payment { padding: 24px; }
      .kicker { color: #166534; font-size: 12px; font-weight: 900; margin: 0 0 8px; text-transform: uppercase; }
      h1 { font-size: 28px; margin: 0 0 12px; }
      p { line-height: 1.5; }
      .qr { align-items: center; background: white; border: 1px solid #d8e5dc; border-radius: 8px; display: inline-flex; margin: 8px 0 6px; padding: 10px; }
      .qr svg { display: block; height: 148px; width: 148px; }
      .qrLabel { color: #4b6355; font-size: 13px; margin-top: 0; }
      button { border: 0; border-radius: 8px; background: #166534; color: white; cursor: pointer; font-weight: 900; padding: 12px 16px; }
      #result { color: #166534; font-weight: 800; min-height: 24px; }
    `,
    script: `
      document.querySelector("#pay").addEventListener("click", () => {
        document.querySelector("#result").textContent = "Payment request sent to host client.";
        parent.postMessage({
          type: "trusted-mail-action",
          action: "pay_invoice",
          payment: ${JSON.stringify(paymentPayload)}
        }, "*");
      });
    `,
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 15)
  });
  const signed = await messageSigner.signEd25519(message, keyPair.privateKey);
  return serializeSignedMessage(signed, route);
}

function createPaymentRequestPayload() {
  return {
    kind: "host-mediated-payment-request",
    invoiceId: "2026-0608",
    merchant: {
      domain: manifest.domain,
      displayName: manifest.displayName
    },
    amount: {
      value: "184.90",
      currency: "EUR"
    },
    description: "Invoice #2026-0608",
    orderReference: "order-2026-0608",
    confirmationUx: "qr_code",
    fallbackProvider: {
      type: "qr_code",
      label: "Scan to pay",
      qrPayload: "https://billing.acme.tld/pay/invoices/2026-0608?amount=184.90&currency=EUR"
    },
    expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString()
  };
}

function serializeSignedMessage(signed, route) {
  return {
    ...signed,
    receivedAt: signed.receivedAt.toISOString(),
    expiresAt: signed.expiresAt?.toISOString()
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(request, response, value, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(request)
  });
  response.end(JSON.stringify(value, null, 2));
}

function isAllowedBrowserOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  if (!origin || !isAllowedBrowserOrigin(request)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}
