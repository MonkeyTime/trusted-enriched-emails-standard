import { webcrypto } from "node:crypto";
import { SignatureVerifier } from "../packages/typescript/dist/index.js";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

const verifier = new SignatureVerifier(webcrypto);
const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKeyBytes = new Uint8Array(await webcrypto.subtle.exportKey("raw", keyPair.publicKey));
const publicKey = `ed25519:${base64Url(publicKeyBytes)}`;

const message = {
  id: "crypto-vector-001",
  source: "realtime",
  domain: "billing.acme.tld",
  channelId: "invoice-events",
  from: "billing@acme.tld",
  subject: "Signed message",
  html: "<article><h1>Signed</h1></article>",
  css: "body { font-family: sans-serif; }",
  capabilities: ["render:html", "render:css"],
  receivedAt: new Date("2026-06-08T08:00:00.000Z")
};

message.signature = await verifier.signEd25519(message, keyPair.privateKey);
const valid = await verifier.verifyEd25519(message, publicKey);
const tampered = await verifier.verifyEd25519({ ...message, subject: "Tampered" }, publicKey);

if (!valid) {
  console.error("FAIL crypto vector: valid signature rejected");
  process.exit(1);
}

if (tampered) {
  console.error("FAIL crypto vector: tampered message accepted");
  process.exit(1);
}

console.log("PASS crypto vector: Ed25519 sign/verify and tamper detection");

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
