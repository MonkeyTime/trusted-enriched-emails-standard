import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const php = spawnSync("php", ["-v"], { encoding: "utf8" });

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
];

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`FAIL missing PHP SDK file: ${file}`);
    process.exit(1);
  }
  const lint = spawnSync("php", ["-l", file], { encoding: "utf8" });
  if (lint.status !== 0) {
    console.error(lint.stderr || lint.stdout);
    process.exit(lint.status ?? 1);
  }
}

console.log("PASS PHP SDK syntax check");
