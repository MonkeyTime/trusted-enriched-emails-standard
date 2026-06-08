import { readFile } from "node:fs/promises";
import ts from "typescript";
import { StatePolicy } from "../packages/typescript/dist/index.js";

const source = await readFile(new URL("../apps/web-client/src/client-state-store.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
const { ClientStateStore } = await import(moduleUrl);

const storage = memoryStorage();
const store = new ClientStateStore(storage);

assert(StatePolicy.evaluateDomainState("billing.acme.tld", store.domainSnapshot()) === "trusted", "default trusted domain");
store.muteDomain("billing.acme.tld");
assert(StatePolicy.evaluateDomainState("billing.acme.tld", store.domainSnapshot()) === "muted", "muted domain");
store.revokeDomain("billing.acme.tld");
assert(StatePolicy.evaluateDomainState("billing.acme.tld", store.domainSnapshot()) === "revoked", "revoked domain");
assert(!store.isSubscribed("billing.acme.tld", "invoice-events"), "revocation removes subscription");

store.trustDomain("billing.acme.tld");
store.subscribe("billing.acme.tld", "invoice-events");
store.deleteMessage("message-001");
const message = {
  id: "message-001",
  source: "realtime",
  domain: "billing.acme.tld",
  channelId: "invoice-events",
  from: "billing@acme.tld",
  subject: "State test",
  html: "<p>State test</p>",
  capabilities: ["render:html"],
  receivedAt: new Date("2026-06-08T08:00:00.000Z")
};
assert(StatePolicy.evaluateMessageState(message, store.messageSnapshot(new Date("2026-06-08T08:01:00.000Z"))) === "deleted", "deleted message state");

const reloaded = new ClientStateStore(storage);
assert(StatePolicy.evaluateDomainState("billing.acme.tld", reloaded.domainSnapshot()) === "trusted", "trusted state persists");
assert(reloaded.isSubscribed("billing.acme.tld", "invoice-events"), "subscription persists");
assert(StatePolicy.evaluateMessageState(message, reloaded.messageSnapshot(new Date("2026-06-08T08:01:00.000Z"))) === "deleted", "deleted message persists");

console.log("PASS web client persistent state store");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
