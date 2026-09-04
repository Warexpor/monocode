# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is **not** a portability target.

This document does **not** claim a live Claude/`ocx` session or a pixel-level DWM screenshot. Warexpor’s home PC owns visual glass and interactive UI smoke.

## Done in code (and, where noted, GitHub Actions)

| Item | Upstream (macOS/Linux) | Windows | Evidence |
|------|------------------------|---------|----------|
| Login PATH | `zsh`/`bash` `-lic printenv` | PowerShell Machine+User+Process PATH (process first) | 1TO1 (CI) |
| Harness/PTY kill | process group SIGTERM then SIGKILL | `taskkill /T` then Toolhelp + `TerminateProcess` | 1TO1 (CI) |
| Job assign / kill-on-close | `process_group(0)` | `CREATE_BREAKAWAY_FROM_JOB` + kill-on-close Job | 1TO1 (CI `job_kill_on_close_reaps_the_child`) |
| Orphan reap | `/proc` or `ps` + `MONOCODE_HARNESS_PARENT` | PEB environ + Toolhelp | 1TO1 (CI `windows_reap_tests`) |
| Git / GUI PATH | login-shell PATH | `gui_search_path` + `git_cmd` / `resolve_gui_binary` | 1TO1 (code + tests) |
| Harness CLI resolve | POSIX dirs then login PATH | Same `gui_search_path` as PTY (npm, scoop, Git, Node) | 1TO1 (code + tests) |
| npm `.cmd` shims | shebang argv | `command_for_args` → `cmd.exe /D /S /C` with program **and** args in one string | 1TO1 (code + tests) |
| Default terminal | `$SHELL` else zsh/bash `-l` | `$SHELL` if present; else Git `bash.exe -l`; else pwsh/powershell; else `COMSPEC` | 1TO1 (code) |
| Terminal titles | `TIOCGPGRP` + `ps -o args=` | Toolhelp (8 shells), remote `NtQuery` / PEB `CommandLine`, `path_stem` / `command_label` | 1TO1 (code + Ubuntu tests) |
| Paths to JS | POSIX | `path_to_js` on list/git/search/create/rename/copy/move/clone/attach/default cwd/logo | 1TO1 (code) |
| Terminal Ctrl | skip `tabCommand` in `.monocode-terminal` | `shouldIgnoreTerminalCtrlChord` | 1TO1 |
| Accelerators | native `menu.rs` | HTML `MenuBar` (File/View splits, tabs, focus, Settings, Quit) + `App.tsx` (`Ctrl+Q/O/Shift+N/B/P/K/,/Shift+F/.`) | 1TO1 (code) |
| Claude creds | Keychain on macOS; `0o600` file on Linux | File store + owner+SYSTEM DACL | 1TO1 (code) |
| NSIS first-run | n/a | Silent install + launch on `windows-latest` | 1TO1 (CI) — not interactive desktop UX |
| DWM glass apply | CGS blur | Radius → Blur/Acrylic/Mica order, then solid; Rust applies on `Ready` / new windows (JS re-applies after splash) | 1TO1 (CI sidecar) — **not** a pixel screenshot |

Latest GHA proof on `origin/main` `49faefc` (`33878426385`): `check` green macOS/Ubuntu/Windows; NSIS `starterAlive=True named=1`; `DWM glass fallback=acrylic`. PR #1 also applies glass from Rust so the sidecar does not wait on JS boot.

## Still needs Warexpor’s Windows PC

These cannot be closed on this Linux cloud VM (no GPU DWM session, no machine-local `ocx`):

- **Visual glass** — whether Acrylic *looks* like CGS blur on an interactive desktop (CI only proved `set_effects` succeeded).
- **Interactive NSIS** — installer wizard, shortcuts, uninstaller UX. GHA already silent-installed and launched once.
- **Job kill-on-close on a real desktop** — GHA unit test already passed; re-check only if a desktop spawn still orphans.
- **Live `ocx` / Claude session** — `127.0.0.1:10100`, model `claude-opus-4-8-20261030`. Not transferable. Do not invent `SESSION_OK`.
- **Taskbar icon** — ~~running window shows a blank/generic taskbar entry~~ **fixed on `custom/warexpor`**: `apply_windows_window_icon` re-applies `default_window_icon` on window create and Ready (undecorated HWND). Re-verify after `tauri dev` and NSIS install; promote to `main` when syncing.

## N/A (OS chrome, not a portability target)

Dock badge / reopen, native macOS menu extras (Hide/About), Keychain `security` CLI.

## Upstream

`main` tracks `hardbeat920/monocode` plus Windows. `custom/warexpor` fast-forwards until product commits. `./scripts/sync-upstream.sh --dry-run` (and `scripts/sync-upstream.ps1`).
