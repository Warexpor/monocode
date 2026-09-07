#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.RUSTUP_TOOLCHAIN ??= "stable-x86_64-pc-windows-msvc";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Spawn node + tauri.js. On Windows, `tauri.cmd` from `.bin` is not a valid
// CreateProcess image unless `shell: true`, and that was exiting 1 with no
// Tauri output on GitHub Actions.
const cli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
if (!existsSync(cli)) {
  console.error(
    `Missing ${cli}. Run npm ci (or npm install) before npm run build:windows.`,
  );
  process.exit(1);
}
const args = [cli, "build", "--bundles", "nsis"];
// Release sets TAURI_SIGNING_PRIVATE_KEY so updater zip+sig are produced.
// Local/CI smoke builds without a key must skip signing or tauri build fails.
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  args.push(
    "--config",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
  );
}
const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);
