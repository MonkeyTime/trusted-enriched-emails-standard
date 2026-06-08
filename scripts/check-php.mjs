import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const phpExecutable = findPhpExecutable();
const php = phpExecutable ? spawnSync(phpExecutable, ["-v"], { encoding: "utf8" }) : { error: { code: "ENOENT" } };

if (php.error?.code === "ENOENT") {
  console.log("SKIP PHP SDK check: php executable not found");
  process.exit(0);
}

if (php.status !== 0) {
  console.error(php.stderr || php.stdout);
  process.exit(php.status ?? 1);
}

const files = [
  "packages/php/src/RealtimeMail.php",
  "scripts/validate-php-conformance.php",
];

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`FAIL missing PHP SDK file: ${file}`);
    process.exit(1);
  }
  const lint = spawnSync(phpExecutable, ["-l", file], { encoding: "utf8" });
  if (lint.status !== 0) {
    console.error(lint.stderr || lint.stdout);
    process.exit(lint.status ?? 1);
  }
}

const conformance = spawnSync(phpExecutable, ["scripts/validate-php-conformance.php"], { encoding: "utf8" });
if (conformance.status !== 0) {
  console.error(conformance.stdout);
  console.error(conformance.stderr);
  process.exit(conformance.status ?? 1);
}

process.stdout.write(conformance.stdout);
console.log("PASS PHP SDK syntax and conformance check");

function findPhpExecutable() {
  const candidates = [
    "php",
    "C:\\php-7.4.x\\php.exe",
  ];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-v"], { encoding: "utf8" });
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }
  return undefined;
}
