import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

const candidates = [
  "C:/Program Files/Go/bin/go.exe",
  "C:/Program Files (x86)/Go/bin/go.exe",
  "go"
];

const go = await findExecutable(candidates);
if (!go) {
  console.error("Go toolchain not found. Add go to PATH or install it in C:/Program Files/Go.");
  process.exit(1);
}

process.exitCode = await run(go, ["test", "./..."], { cwd: new URL("../packages/go/", import.meta.url) });

async function findExecutable(paths) {
  for (const path of paths) {
    try {
      if (!path.includes("/") && !path.includes("\\")) {
        return path;
      }
      await access(path);
      return path;
    } catch {
      // Try next candidate.
    }
  }
  return undefined;
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}
