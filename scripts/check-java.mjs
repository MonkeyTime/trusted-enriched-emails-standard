import { access, mkdir, readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const javaHome = process.env.JAVA_HOME;
const javac = await findExecutable([
  javaHome ? join(javaHome, "bin", executable("javac")) : undefined,
  "C:/Program Files/Java/jdk-21.0.11/bin/javac.exe",
  "javac"
]);
const java = await findExecutable([
  javaHome ? join(javaHome, "bin", executable("java")) : undefined,
  "C:/Program Files/Java/jdk-21.0.11/bin/java.exe",
  "java"
]);

if (!javac || !java) {
  console.error("Java toolchain not found. Set JAVA_HOME or add java and javac to PATH.");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, ".tmp", "java-classes");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const sourceRoots = [
  join(root, "packages", "java", "src", "main", "java", "org", "realtimemail"),
  join(root, "packages", "java", "src", "test", "java", "org", "realtimemail")
];
const sources = (await Promise.all(sourceRoots.map(findJavaFiles))).flat();

let code = await run(javac, ["-d", out, ...sources]);
if (code === 0) {
  code = await run(java, ["-cp", out, "org.realtimemail.ConformanceSmoke"]);
}

process.exitCode = code;

async function findJavaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".java"))
    .map((entry) => join(directory, entry.name));
}

async function findExecutable(paths) {
  for (const path of paths.filter(Boolean)) {
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

function executable(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, stdio: "inherit" });
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
    child.on("error", () => resolve(1));
  });
}
