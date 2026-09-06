#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Match build-windows.mjs: windows-gnu test exes import ComCtl32 v6
// (TaskDialogIndirect) without an SxS manifest, so the loader binds
// System32 comctl32 5.82 and fails with STATUS_ENTRYPOINT_NOT_FOUND.
// Use a dedicated target dir so a GNU default host cannot pollute MSVC deps.
if (process.platform === "win32") {
  process.env.RUSTUP_TOOLCHAIN ??= "stable-x86_64-pc-windows-msvc";
  process.env.CARGO_TARGET_DIR ??= join(root, "target-msvc");
}

const steps = [
  ["fmt", ["fmt", "--check"]],
  ["clippy", ["clippy", "--workspace", "--all-targets", "--", "-D", "warnings"]],
  ["test", ["test"]],
];

for (const [label, args] of steps) {
  const result = spawnSync("cargo", args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`cargo ${label} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}
