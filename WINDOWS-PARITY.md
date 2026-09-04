# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is not a portability target.

| Item | Upstream (macOS/Linux) | Windows now | Class |
|------|------------------------|-------------|-------|
| Window glass | `macos::enable_glass` via CGS blur (`src-tauri/src/macos.rs`) | `apply_windows_glass`: radius 1–12 Blur, 13–40 Acrylic, 41–64 Mica, then remaining DWM materials, then solid. CI first-run on `0ffa6b9` (`33874438372`) recorded `DWM glass fallback=acrylic` | 1TO1 (CI) |
| Sidebar blur radius | `set_background_blur_radius` 1–64 | Stores the macOS 1–64 value and remaps DWM material (no per-pixel CGS radius) | 1TO1 (code) |
| Login PATH | `zsh`/`bash` `-lic printenv` (`load_unix_login_shell_env`) | PowerShell prints Machine+User+Process PATH (joined, process first) plus profile; other `LOGIN_SHELL_KEYS` from Process then User | 1TO1 (CI) |
| Harness/PTY kill | process group SIGTERM then SIGKILL | TERM via `taskkill /T`; SIGKILL via Toolhelp descendants + `TerminateProcess`; Job drop still covers assigned trees | 1TO1 (CI) |
| Git PATH | `Command::new("git")` | `git_cmd()` uses `resolve_gui_binary("git")` + `apply_gui_env` (search + checkpoint too) | 1TO1 |
| Harness CLI resolve | login-shell PATH after POSIX install dirs | Same `gui_search_path` as PTY/git (login PATH plus `AppData\Roaming\npm`, scoop shims, Git, Node) so Explorer-launched MonoCode finds `opencode.exe` | 1TO1 (code) |
| npm `.cmd` shims | shebang scripts | `command_for_args` runs `.cmd`/`.bat` via `cmd.exe /D /S /C` with program and args in one string so `CREATE_NO_WINDOW` can start npm-global `opencode.cmd serve` | 1TO1 (code) |
| Default terminal | `$SHELL` else zsh/bash, `-l` for bash/zsh | `$SHELL` if it exists; else Git `bash.exe` (`-l`) as the Linux `/bin/bash` analog; else pwsh/powershell (`-NoLogo`); else `COMSPEC`. `Git\\bin` on search PATH | 1TO1 (code) |
| Terminal Ctrl | Mac skips every `tabCommand` for Ctrl in `.monocode-terminal` | `shouldIgnoreTerminalCtrlChord` does the same | 1TO1 |
| Path separators to JS | POSIX | `path_to_js` on list/git/search and create/rename/copy/move/clone/attach | 1TO1 |
| Harness Job assign | Unix `process_group(0)` | `CREATE_BREAKAWAY_FROM_JOB` plus kill-on-close Job. `job_kill_on_close_reaps_the_child` passed on GitHub `windows-latest` | 1TO1 (CI) |
| Terminal titles | `TIOCGPGRP` + `ps -o args=` | Toolhelp walk (8 nested shells), `NtQuery` command line with `ReadProcessMemory` when the buffer is remote, PEB `CommandLine` fallback; else image name | 1TO1 (code) |
| Cmd/Ctrl accelerators | native `menu.rs` plus `App.tsx` | HTML `MenuBar` (Settings, Quit, terminal tab, Sidebar Appearance) plus `App.tsx` (`Ctrl+Q` / `Ctrl+O` / `Ctrl+Shift+N`; terminal Ctrl skipped like Mac) | 1TO1 (code) |
| Dock badge / reopen | `NSApplication` dock + `RunEvent::Reopen` | Last window close quits (`lib.rs` `ExitRequested`) | N/A |
| Claude usage Keychain | `security` CLI | file store under user config (same as Linux); Windows applies owner+SYSTEM DACL (`restrict_owner_acl`) as the `0o600` analog used for Linear tokens | 1TO1 (code) |
| Orphan harness sweep | `/proc` or `ps` + `MONOCODE_HARNESS_PARENT` | Same marker via PEB environ + Toolhelp; `windows_reap_tests::reap_snapshots_kills_a_marked_orphan` passed on GitHub `windows-latest` | 1TO1 (CI) |
| NSIS installer | n/a | `tauri.windows.conf.json` bundle `nsis`; CI `Windows NSIS` on `c491513` (`33872243241`) built `MonoCode_0.1.32_x64-setup.exe`, silent-installed, launched `monocode.exe`, process still alive after 20s | 1TO1 (CI) |
| Live Claude via `ocx` | n/a | Proven only on the Warexpor Windows PC | NOT_1TO1 until Windows smoke |

## Still needs a Windows desktop (not GHA Server)

- Whether Acrylic *looks* like CGS blur on a real interactive DWM session (CI recorded `set_effects(Acrylic)` succeeded; it did not capture pixels).
- Live harness session (`ocx` is machine-local; this Linux VM is not that proof).

GitHub Actions on `origin/main` `0ffa6b9` (`33874438372`): `check` green on macOS/Ubuntu/Windows, `Windows NSIS` silent-install launched `monocode.exe` (alive 20s) and wrote `DWM glass fallback=acrylic`. That is CI proof of build/install/launch/glass-apply, not a live `ocx` session.

## Upstream drift (dry-run)

`origin/main` tracks `hardbeat920/monocode` `main` plus Windows. `custom/warexpor` fast-forwards from `main` until product commits land. `./scripts/sync-upstream.sh --dry-run` (and the PowerShell twin) report behind/ahead against `upstream/main`.
