# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is not a portability target.

| Item | Upstream (macOS/Linux) | Windows now | Class |
|------|------------------------|-------------|-------|
| Window glass | `macos::enable_glass` via CGS blur (`src-tauri/src/macos.rs`) | `apply_windows_glass`: Acrylic, Mica, MicaDark, Blur, then solid `Color(18,18,18,255)` | PARTIAL |
| Sidebar blur radius | `set_background_blur_radius` 1–64 | Re-applies DWM glass. No per-pixel radius | PARTIAL |
| Login PATH | `zsh`/`bash` `-lic printenv` (`load_unix_login_shell_env`) | PowerShell prints Machine+User+Process PATH (joined, process first) plus profile; other `LOGIN_SHELL_KEYS` from Process then User | 1TO1 (CI) |
| Harness/PTY kill | process group SIGTERM then SIGKILL | TERM via `taskkill /T`; SIGKILL via Toolhelp descendants + `TerminateProcess`; Job drop still covers assigned trees | 1TO1 (CI) |
| Git PATH | `Command::new("git")` | `git_cmd()` uses `resolve_gui_binary("git")` + `apply_gui_env` (search + checkpoint too) | 1TO1 |
| Default terminal | `$SHELL` else zsh/bash, `-l` for bash/zsh | Real `$SHELL` file or PATH lookup, `-l` for bash/zsh/sh, else pwsh. `Git\\bin` on search PATH | PARTIAL |
| Terminal Ctrl | Mac skips every `tabCommand` for Ctrl in `.monocode-terminal` | `shouldIgnoreTerminalCtrlChord` does the same | 1TO1 |
| Path separators to JS | POSIX | `path_to_js` on list/git/search and create/rename/copy/move/clone/attach | 1TO1 |
| Harness Job assign | Unix `process_group(0)` | `CREATE_BREAKAWAY_FROM_JOB` plus kill-on-close Job. `job_kill_on_close_reaps_the_child` passed on GitHub `windows-latest` | 1TO1 (CI) |
| Terminal titles | `TIOCGPGRP` + `ps -o args=` | Toolhelp walk, then `NtQueryInformationProcess` command line when allowed; else image name | PARTIAL until Windows smoke |
| Cmd/Ctrl accelerators | native `menu.rs` plus `App.tsx` | HTML `MenuBar` plus `App.tsx` (`Ctrl+O`, `Ctrl+Shift+N` included) | PARTIAL |
| Dock badge / reopen | `NSApplication` dock + `RunEvent::Reopen` | Last window close quits (`lib.rs` `ExitRequested`) | N/A |
| Claude usage Keychain | `security` CLI | file store under user config (same as Linux) | N/A |
| Orphan harness sweep | `/proc` or `ps` + `MONOCODE_HARNESS_PARENT` | Same marker via PEB environ + Toolhelp; `windows_reap_tests::reap_snapshots_kills_a_marked_orphan` passed on GitHub `windows-latest` | 1TO1 (CI) |
| NSIS installer | n/a | `tauri.windows.conf.json` bundle `nsis`; CI job `Windows NSIS` ran `npm run build:windows` on `f78e490` and uploaded `windows-nsis` (~8.4 MiB) | 1TO1 (CI) |
| Live Claude via `ocx` | n/a | Proven only on the Warexpor Windows PC | NOT_1TO1 until Windows smoke |

## Still needs a Windows machine

- First-run of the NSIS installer (CI built and uploaded it; it did not install or launch the app).
- Acrylic vs Mica vs solid fallback on a real DWM session.
- Live harness session (`ocx` is machine-local; this Linux VM is not that proof).

GitHub Actions on `origin/main` `e81f999` (`33868756420`): `check` green on macOS/Ubuntu/Windows, `Windows NSIS` green, `windows_reap_tests::reap_snapshots_kills_a_marked_orphan` and `job_kill_on_close_reaps_the_child` both ok. That is CI proof of build/kill/orphan-reap, not a desktop DWM/`ocx` session.

## Upstream drift (dry-run)

`origin/main` tracks `hardbeat920/monocode` `main` plus Windows. `custom/warexpor` fast-forwards from `main` until product commits land. `./scripts/sync-upstream.sh --dry-run` (and the PowerShell twin) report behind/ahead against `upstream/main`.
