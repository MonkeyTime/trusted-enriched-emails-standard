import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ActionValidator, ManifestValidator, MessageValidator, PaymentRequestPayloadValidator, ValidationError } from "../packages/typescript/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const cases = [
  {
    file: "conformance/valid-manifest.acme.json",
    validator: ManifestValidator,
    valid: true
  },
  {
    file: "conformance/invalid-manifest.missing-keys.json",
    validator: ManifestValidator,
    valid: false
  },
  {
    file: "conformance/invalid-manifest.unknown-channel-property.json",
    validator: ManifestValidator,
    valid: false
  },
  {
    file: "conformance/valid-message.invoice.json",
    validator: MessageValidator,
    valid: true
  },
  {
    file: "conformance/invalid-message.script-without-capability.json",
    validator: MessageValidator,
    valid: false
  },
  {
    file: "conformance/invalid-message.unknown-property.json",
    validator: MessageValidator,
    valid: false
  },
  {
    file: "conformance/valid-action.open-url.json",
    validator: ActionValidator,
    valid: true
  },
  {
    file: "conformance/valid-action.payment-request.json",
    validator: ActionValidator,
    valid: true
  },
  {
    file: "conformance/invalid-action.no-user-gesture.json",
    validator: ActionValidator,
    valid: false
  },
  {
    file: "conformance/invalid-action.cross-domain-url.json",
    validator: ActionValidator,
    valid: false
  },
  {
    file: "conformance/invalid-action.payment-request.missing-merchant.json",
    validator: ActionValidator,
    valid: false
  },
  {
    file: "conformance/valid-action.payment-request.json",
    validator: {
      parse: (value) => PaymentRequestPayloadValidator.parse(value.payload)
    },
    valid: true
  }
];

let failures = 0;

for (const testCase of cases) {
  const content = await readFile(join(root, testCase.file), "utf8");
  const json = JSON.parse(content);
  try {
    testCase.validator.parse(json);
    if (!testCase.valid) {
      failures += 1;
      console.error(`FAIL ${testCase.file}: expected validation failure`);
    } else {
      console.log(`PASS ${testCase.file}`);
    }
  } catch (error) {
    if (testCase.valid || !(error instanceof ValidationError)) {
      failures += 1;
      console.error(`FAIL ${testCase.file}: ${error.message}`);
    } else {
      console.log(`PASS ${testCase.file}`);
    }
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
