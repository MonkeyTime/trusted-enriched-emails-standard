import { access, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const cargoCandidates = [
  `${homedir()}/.cargo/bin/cargo.exe`,
  "cargo"
];

const cargo = await findExecutable(cargoCandidates);
if (!cargo) {
  console.error("Cargo not found. Add cargo to PATH or install Rust through rustup.");
  process.exit(1);
}

const vcvarsRoot = "C:/Program Files/Microsoft Visual Studio/18/Community/VC/Auxiliary/Build";
const vcvars64 = `${vcvarsRoot}/vcvars64.bat`;
const vcvarsAll = `${vcvarsRoot}/vcvarsall.bat`;
const hasVcvars = await exists(vcvars64) && await exists(vcvarsAll);
const cargoCommand = cargo.replaceAll("/", "\\");
const msvcFallback = process.platform === "win32" && await usesMsvcTarget(cargo)
  ? await findMsvcFallback()
  : undefined;

if (process.platform === "win32" && !hasVcvars && !msvcFallback && await usesMsvcTarget(cargo)) {
  console.error([
    "Rust is installed, but the MSVC build environment is incomplete.",
    `Missing ${toWindowsPath(vcvarsAll)}.`,
    "Install the Visual Studio C++ build tools and a Windows SDK, then rerun npm run rust:check."
  ].join("\n"));
  process.exit(1);
}

process.exitCode = hasVcvars
  ? await run("cmd.exe", ["/d", "/s", "/c", `"call "${toWindowsPath(vcvars64)}" && "${cargoCommand}" test"`], { cwd: new URL("../packages/rust/", import.meta.url) })
  : await run(cargo, ["test"], {
      cwd: new URL("../packages/rust/", import.meta.url),
      env: msvcFallback ? withMsvcFallback(process.env, msvcFallback) : process.env
    });

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

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function toWindowsPath(path) {
  return path.replaceAll("/", "\\");
}

async function usesMsvcTarget(cargoPath) {
  const rustcPath = cargoPath.replace(/cargo(\.exe)?$/i, "rustc$1");
  const rustc = await exists(rustcPath) ? rustcPath : "rustc";
  const output = await capture(rustc, ["-vV"]);
  return output.includes("host:") && output.includes("windows-msvc");
}

function capture(command, args) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(command, args, { shell: false });
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    child.on("exit", () => resolve(output));
    child.on("error", () => resolve(""));
  });
}

async function findMsvcFallback() {
  const msvcRoot = "C:/Program Files/Microsoft Visual Studio/18/Community/VC/Tools/MSVC";
  const sdkLibRoot = "C:/Program Files (x86)/Windows Kits/10/Lib";
  const msvcVersion = await latestDirectory(msvcRoot);
  const sdkVersion = await latestDirectory(sdkLibRoot);
  if (!msvcVersion || !sdkVersion) {
    return undefined;
  }

  const msvcLib = join(msvcRoot, msvcVersion, "lib", "x64");
  const msvcOneCoreLib = join(msvcRoot, msvcVersion, "lib", "onecore", "x64");
  const selectedMsvcLib = await exists(join(msvcLib, "msvcrt.lib"))
    ? msvcLib
    : await exists(join(msvcOneCoreLib, "msvcrt.lib"))
      ? msvcOneCoreLib
      : undefined;
  const sdkUmLib = join(sdkLibRoot, sdkVersion, "um", "x64");
  const sdkUcrtLib = join(sdkLibRoot, sdkVersion, "ucrt", "x64");
  if (!selectedMsvcLib || !await exists(join(sdkUmLib, "kernel32.Lib")) || !await exists(sdkUcrtLib)) {
    return undefined;
  }

  return {
    lib: [selectedMsvcLib, sdkUmLib, sdkUcrtLib].map(toWindowsPath).join(";"),
    rustflags: appendFlag(process.env.RUSTFLAGS, "-C linker=rust-lld")
  };
}

async function latestDirectory(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      [0];
  } catch {
    return undefined;
  }
}

function withMsvcFallback(env, fallback) {
  return {
    ...env,
    LIB: env.LIB ? `${fallback.lib};${env.LIB}` : fallback.lib,
    RUSTFLAGS: fallback.rustflags
  };
}

function appendFlag(current, flag) {
  return current?.includes(flag) ? current : [current, flag].filter(Boolean).join(" ");
}
