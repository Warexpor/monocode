# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is not a portability target.

Remotes and sync: `UPSTREAM.md`. Product overlay: `CUSTOM.md`.

This document does not claim a live Claude/`ocx` session or a pixel-level DWM screenshot. Warexpor’s home PC owns visual glass and interactive UI smoke.

## What CI proves (and where)

Workflow: `.github/workflows/ci.yml`. Latest green push on `origin/main` `8e30be0`: [run 33883482964](https://github.com/Warexpor/monocode/actions/runs/33883482964).

| Job | Runner | What it actually ran |
|-----|--------|----------------------|
| `check` | `ubuntu-latest` | `npm test`, `tsc`, rustfmt, clippy, `cargo test` on Linux. POSIX harness/PTY paths. Some Windows-oriented unit tests still compile/run here when they are not `cfg(windows)`-only. |
| `check` | `windows-latest` | Same suite on Windows. Job Objects, `taskkill`, PEB reap, PATH/shim tests that are `cfg(windows)` live here. |
| `windows-nsis` | `windows-latest` | `npm run build:windows` → one NSIS `.exe` → `scripts/windows-nsis-smoke.ps1` silent `/S` install, launch, process still up, sidecar `DWM glass fallback=acrylic`. |

Linux cloud VMs (this class of agent) are `check` on Ubuntu only unless you run the Windows jobs. They cannot prove DWM pixels, NSIS wizard UX, or a machine-local `ocx` session. There is no `macos-latest` `check` job: it duplicated the Linux suite and this fork does not ship macOS artifacts.

`npm run check` locally is the `check` job, not NSIS.

## Done in code (and, where noted, GitHub Actions)

| Item | Upstream (macOS/Linux) | Windows | Evidence |
|------|------------------------|---------|----------|
| Login PATH | `zsh`/`bash` `-lic printenv` | PowerShell Machine+User+Process PATH (process first) | 1TO1 (CI `check` windows) |
| Harness/PTY kill | process group SIGTERM then SIGKILL | `taskkill /T` then Toolhelp + `TerminateProcess` | 1TO1 (CI `check` windows) |
| Job assign / kill-on-close | `process_group(0)` | `CREATE_BREAKAWAY_FROM_JOB` + kill-on-close Job | 1TO1 (CI `job_kill_on_close_reaps_the_child`) |
| Orphan reap | `/proc` or `ps` + `MONOCODE_HARNESS_PARENT` | PEB environ + Toolhelp | 1TO1 (CI `windows_reap_tests`) |
| Git / GUI PATH | login-shell PATH | `gui_search_path` + `git_cmd` / `resolve_gui_binary` | 1TO1 (code + tests) |
| Harness CLI resolve | POSIX dirs then login PATH | Same `gui_search_path` as PTY (npm, scoop, Git, Node) | 1TO1 (code + tests) |
| npm `.cmd` shims | shebang argv | `command_for_args` → `cmd.exe /D /S /C` with program **and** args in one string | 1TO1 (code + tests) |
| Default terminal | `$SHELL` else zsh/bash `-l` | `$SHELL` if present; else Git `bash.exe -l`; else pwsh/powershell; else `COMSPEC` | 1TO1 (code) |
| Terminal titles | `TIOCGPGRP` + `ps -o args=` | Toolhelp (8 shells), remote `NtQuery` / PEB `CommandLine`, `path_stem` / `command_label` | 1TO1 (code + Ubuntu tests) |
| Paths to JS | POSIX | `path_to_js` / `slash_cwd` on list/git/search/create/rename/copy/move/clone/attach/default cwd/logo/session cwd | 1TO1 (code) |
| IPC path errors | `path: No such file or directory` (`/` separators) | Same `path_to_js` prefix; `ErrorKind` mapped to POSIX wording (not Win32 English) | 1TO1 (code + tests) |
| Terminal Ctrl | skip `tabCommand` in `.monocode-terminal` | `shouldIgnoreTerminalCtrlChord` | 1TO1 |
| Accelerators | native `menu.rs` (incl. Edit → Find) | HTML `MenuBar` (File/View splits, tabs, focus, Settings, Quit, Find) + `App.tsx` (`Ctrl+Q/O/Shift+N/B/P/K/,/Shift+F/.` and `Ctrl+F` find) | 1TO1 (code) |
| Claude creds | Keychain on macOS; `0o600` file on Linux | File store + owner+SYSTEM DACL | 1TO1 (code) |
| NSIS first-run | n/a | Silent install + launch on `windows-latest` | 1TO1 (CI `windows-nsis`) — not interactive desktop UX |
| DWM glass apply | CGS blur | Radius → Blur/Acrylic/Mica order, then solid; Rust applies on `Ready` / new windows (JS re-applies after splash) | 1TO1 (CI sidecar `fallback=acrylic` on `8e30be0`) — not a pixel screenshot |

PR #1 applies glass from Rust so the sidecar does not wait on JS boot.

## Still needs Warexpor’s Windows PC

These cannot be closed on a Linux cloud VM (no GPU DWM session, no machine-local `ocx`):

- **Visual glass** — whether Acrylic *looks* like CGS blur on an interactive desktop (CI only proved `set_effects` succeeded).
- **Interactive NSIS** — installer wizard, shortcuts, uninstaller UX. GHA already silent-installed and launched once.
- **Job kill-on-close on a real desktop** — GHA unit test already passed; re-check only if a desktop spawn still orphans.
- **Live `ocx` / Claude session** — `127.0.0.1:10100`, model `claude-opus-4-8-20261030`. Not transferable. Do not invent `SESSION_OK`.
- **HTML Edit menu extras** — macOS has native Undo/Redo/Cut/Copy/Paste/Select All. The webview already handles those chords; this pass only added Find to the Windows `MenuBar` (no new Edit chrome).

## N/A (OS chrome, not a portability target)

Dock badge / reopen, native macOS menu extras (Hide/About), Keychain `security` CLI.
