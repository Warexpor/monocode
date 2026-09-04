# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is not a portability target.

| Item | Upstream (macOS/Linux) | Windows now | Class |
|------|------------------------|-------------|-------|
| Window glass | `macos::enable_glass` via CGS blur (`src-tauri/src/macos.rs`) | `apply_windows_glass`: Acrylic, Mica, MicaDark, Blur, then solid `Color(18,18,18,255)` | PARTIAL |
| Sidebar blur radius | `set_background_blur_radius` 1–64 | Re-applies DWM glass. No per-pixel radius | PARTIAL |
| Login PATH | `zsh`/`bash` `-lic printenv` (`load_unix_login_shell_env`) | PowerShell `-NonInteractive` print of `LOGIN_SHELL_KEYS`, 5s timeout, process env fallback | PARTIAL |
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
| Orphan harness sweep | `/proc` or `ps` + `MONOCODE_HARNESS_PARENT` | Same marker via PEB environ + Toolhelp; Job kill-on-close still covers in-process trees | PARTIAL until Windows smoke |
| NSIS installer | n/a | `tauri.windows.conf.json` bundle `nsis` | NOT_1TO1 until Windows smoke |
| Live Claude via `ocx` | n/a | Proven only on the Warexpor Windows PC | NOT_1TO1 until Windows smoke |

## Still needs a Windows machine

- `npm run build:windows` NSIS artifact and first-run (CI `check` does not bundle NSIS).
- Acrylic vs Mica vs solid fallback on a real DWM session.
- Live harness session (`ocx` is machine-local; this Linux VM is not that proof).

GitHub Actions `windows-latest` `cargo test` on PR #1 (`6ac1488`) ran `windows_job::tests::job_kill_on_close_reaps_the_child` and it passed. That is CI proof of kill-on-close, not a desktop NSIS/DWM/`ocx` session.

## Upstream drift (dry-run)

This branch is stacked on `cursor/sync-upstream-8584`, which merged `upstream/main` through `c804e0e` (plan mode) plus the earlier three commits. After that lands, merge `main` into `custom/warexpor`.
