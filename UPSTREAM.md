# Upstream sync

This GitHub repo is [Warexpor/monocode](https://github.com/Warexpor/monocode), a fork of [hardbeat920/monocode](https://github.com/hardbeat920/monocode).

Product copy, install, and build live in `README.md`. Operator notes for remotes, sync, and the Warexpor updater channel live here, in `WINDOWS-PARITY.md`, and in `CUSTOM.md`.

## Remotes (new clone)

A GitHub clone only has `origin`. Add `upstream` before any sync:

```bash
git remote add upstream https://github.com/hardbeat920/monocode.git
git fetch upstream
git remote -v
```

| Remote | URL | Role |
|--------|-----|------|
| `origin` | `https://github.com/Warexpor/monocode.git` | This fork. Push here. |
| `upstream` | `https://github.com/hardbeat920/monocode.git` | Original MonoCode. Fetch/merge only. |

Do not `git push upstream` and do not push Warexpor branches to `hardbeat920/monocode`.

## Branch layout

| Branch | Purpose |
|--------|---------|
| `main` | Upstream `main` plus the Windows 1:1 port. Default PR base for platform work. |
| `custom/warexpor` | Product overlay (`CUSTOM.md`, `src/custom/`). Stack on current `main`. |
| `feat/windows` | Stale. `main` contains that work and more. Do not land new commits here. |

Keep Windows and custom work out of rewritten history. Merge (or rebase) `upstream/main` into `main`, then merge `main` into `custom/warexpor`.

Windows evidence: `WINDOWS-PARITY.md`. Product-layer rules: `CUSTOM.md`.

## Pull upstream

Scripts live at `scripts/sync-upstream.ps1` and `scripts/sync-upstream.sh`. They fetch `upstream`, compare `main` to `upstream/main`, then fast-forward or merge into local `main`. Both no-op with `--dry-run` / `-DryRun`. Both exit if `upstream` is missing.

From repo root (PowerShell):

```powershell
.\scripts\sync-upstream.ps1 -DryRun
.\scripts\sync-upstream.ps1
```

From repo root (bash / Git Bash):

```bash
./scripts/sync-upstream.sh --dry-run
./scripts/sync-upstream.sh
```

By hand:

```bash
git fetch upstream
git checkout main
git merge upstream/main   # --ff-only when main has no unique commits
git checkout custom/warexpor
git merge main
```

## After sync

1. Resolve conflicts on platform boundaries (`#[cfg(windows)]`, path helpers) on `main`. Resolve product conflicts on `custom/warexpor`.
2. `npm ci` then `npm run check` (same pieces as the GHA `check` matrix on Linux and Windows: vitest, `tsc`, rustfmt, clippy, `cargo test`). On Windows, `check:rust` is `node scripts/check-rust.mjs`. It pins `RUSTUP_TOOLCHAIN` to `stable-x86_64-pc-windows-msvc` (same idea as `build:windows`) and writes to `target-msvc/` so a default GNU rustup host cannot leave mixed artifacts. A GNU host fails `cargo test` at load (`STATUS_ENTRYPOINT_NOT_FOUND`): the GNU test binary imports ComCtl32 v6 `TaskDialogIndirect` without an SxS manifest, so Windows binds System32 `comctl32` 5.82 which lacks that export.
3. On a Windows machine, `npm run build:windows` before calling the sync good. That is `node scripts/build-windows.mjs` (`package.json`); it sets `RUSTUP_TOOLCHAIN` and works from cmd, PowerShell, and Git Bash. For day-to-day `npm run tauri`, set the same MSVC toolchain (`$env:RUSTUP_TOOLCHAIN="stable-x86_64-pc-windows-msvc"`) or `rustup default stable-x86_64-pc-windows-msvc`.
4. Optional: `scripts/windows-nsis-smoke.ps1` after a local NSIS build (GHA already runs it on `windows-latest`).

## In-app updates (Warexpor channel)

Updates use **GitHub Releases** on this fork, not upstream’s R2/Apple pipeline.

| Piece | Value |
|-------|--------|
| Endpoint | `https://github.com/Warexpor/monocode/releases/latest/download/latest.json` |
| Public key | Committed in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| Private key | GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY` (never commit) |
| Workflow | `.github/workflows/release.yml` on `v*` tags (Windows + Linux; no macOS) |

### First-time / rotate keys

```bash
npx tauri signer generate -w ~/.tauri/warexpor-monocode.key --ci
# Put the .pub contents into tauri.conf.json pubkey.
gh secret set TAURI_SIGNING_PRIVATE_KEY -R Warexpor/monocode < ~/.tauri/warexpor-monocode.key
```

If the key has a password, also set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Losing the private key breaks the update channel for already-shipped builds.

### Cut a release

1. Bump `package.json`, `Cargo.toml` workspace version, and `src-tauri/tauri.conf.json` to the same `X.Y.Z`.
2. Add a `## [X.Y.Z]` section to `CHANGELOG.md`.
3. Commit, push `main`, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Wait for the Release workflow. Confirm the release has `latest.json`, the NSIS `.nsis.zip` + `.sig`, and the Linux AppImage `.tar.gz` + `.sig`.
5. Install that build; the sidebar “Check for updates” control should hit your `latest.json`.

Upstream’s Apple/R2 updater secrets are not used here.

## Credit

Windows desktop support originally authored in [hardbeat920/monocode#46](https://github.com/hardbeat920/monocode/pull/46) by [@nonlooped](https://github.com/nonlooped).
