# Windows parity vs upstream

Reference for the 1:1 Windows port against [hardbeat920/monocode](https://github.com/hardbeat920/monocode) `main`. OS-native chrome (traffic lights, Dock badge, Keychain) is not a portability target.

| Item | Upstream (macOS/Linux) | Windows now | Class |
|------|------------------------|-------------|-------|
| Window glass | `macos::enable_glass` via CGS blur (`src-tauri/src/macos.rs`) | `apply_windows_glass`: Acrylic, Mica, MicaDark, Blur, then solid `Color(18,18,18,255)` | PARTIAL |
| Sidebar blur radius | `set_background_blur_radius` 1–64 | Re-applies DWM glass. No per-pixel radius | PARTIAL |
| Login PATH | `zsh`/`bash` `-lic printenv` (`load_unix_login_shell_env`) | PowerShell `-NonInteractive` print of `LOGIN_SHELL_KEYS`, 5s timeout, process env fallback | PARTIAL |
| Harness/PTY kill | process group SIGTERM then SIGKILL | TERM/`taskkill` while Job is held, then drop (kill-on-close) after `KILL_ESCALATE` | PARTIAL until Windows smoke |
| Git PATH | `Command::new("git")` | `git_cmd()` uses `resolve_gui_binary("git")` + `apply_gui_env` (search + checkpoint too) | 1TO1 |
| Default terminal | `$SHELL` else zsh/bash, `-l` for bash/zsh | Real `$SHELL` file or PATH lookup, `-l` for bash/zsh/sh, else pwsh. `Git\\bin` on search PATH | PARTIAL |
| Terminal Ctrl | Mac skips every `tabCommand` for Ctrl in `.monocode-terminal` | `shouldIgnoreTerminalCtrlChord` does the same | 1TO1 |
| Path separators to JS | POSIX | `path_to_js` rewrites `\` to `/` | 1TO1 |
| Reveal in Explorer | `open -R` / `xdg-open` | `explorer /select,` | 1TO1 |
| Cmd/Ctrl accelerators | native `menu.rs` plus `App.tsx` | HTML `MenuBar` plus `App.tsx` (`Ctrl+O`, `Ctrl+Shift+N` included) | PARTIAL |
| Dock badge / reopen | `NSApplication` dock + `RunEvent::Reopen` | Last window close quits (`lib.rs` `ExitRequested`) | N/A |
| Claude usage Keychain | `security` CLI | file store under user config (same as Linux) | N/A |
| Orphan harness sweep | `/proc` or `ps` + marker | Job Object kill-on-close; no `ps` sweep | PARTIAL |
| NSIS installer | n/a | `tauri.windows.conf.json` bundle `nsis` | NOT_1TO1 until Windows smoke |
| Live Claude via `ocx` | n/a | Proven only on the Warexpor Windows PC | NOT_1TO1 until Windows smoke |

## Still needs a Windows machine

- `npm run build:windows` NSIS artifact and first-run.
- `cargo test` for `windows_job::job_kill_on_close_reaps_the_child`.
- Acrylic vs Mica vs solid fallback on a real DWM session.
- Live harness session (`ocx` is machine-local; this Linux VM is not that proof).

## Upstream drift (dry-run)

`./scripts/sync-upstream.sh --dry-run` from `custom/warexpor` @ `bd4a069` vs `upstream/main`:

- ahead 10, behind 3 (`f211602`, `d7e6b6d`, `e36ebd9`)
- merge-base `4d7a7a1`
- would merge, not fast-forward
- `git merge-tree` only reports `CHANGELOG.md` as changed in both

Do not merge those three on this branch. Run `sync-upstream` on `main`, then merge `main` into `custom/warexpor`.
