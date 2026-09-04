#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.RUSTUP_TOOLCHAIN ??= "stable-x86_64-pc-windows-msvc";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Spawn node + tauri.js. On Windows, `tauri.cmd` from `.bin` is not a valid
// CreateProcess image unless `shell: true`, and that was exiting 1 with no
// Tauri output on GitHub Actions.
const cli = join(root, "node_modules", "@tauri-apps/cli", "tauri.js");
const result = spawnSync(process.execPath, [cli, "build", "--bundles", "nsis"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);
