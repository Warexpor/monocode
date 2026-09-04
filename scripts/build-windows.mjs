#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.RUSTUP_TOOLCHAIN ??= "stable-x86_64-pc-windows-msvc";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri",
);
const result = spawnSync(bin, ["build", "--bundles", "nsis"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
