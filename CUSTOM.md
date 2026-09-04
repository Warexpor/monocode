# Warexpor custom layer

This branch (`custom/warexpor`) is where product-specific changes live.

Rules:
1. Do not rewrite `main` history.
2. Keep Windows/platform fixes on `main` (or `feat/windows`) so they merge cleanly with upstream.
3. After `.\scripts\sync-upstream.ps1`, merge `main` into this branch and resolve custom conflicts here.
4. Prefer additive modules under `src/custom/` (or agreed paths) over editing core harness files when possible.

Status: QoL comfort pack + Grok Build GUI parity + UI zoom / rewind / taskbar icon.

## Backlog

- *(empty — QoL audit items shipped on this branch)*

## Shipped here

- **UI zoom** — `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (+ View menu); WebView `setZoom`; persisted as `monocode.uiZoom`.
- **Message rewind** — hover rewind on a user turn; truncates transcript, seeds composer, `forgetHarnessSession` so the next send is a fresh provider conversation. Does not undo file checkpoints.
- **Taskbar icon** — Windows undecorated windows re-apply `default_window_icon` on create / Ready (see `WINDOWS-PARITY.md`).
- **Grok Build GUI parity** — mid-turn follow-ups auto-queue when the harness cannot steer (Grok + fx); Steer control hidden for those harnesses; plan→build clears ACP resume so Build is not stuck in plan permission mode; `session_summary_generated` surfaces as status (+ context); `tool_call` emits `tool.started`; truthful Grok attachment hint; Windows PowerShell install string in availability hint + README; Settings copy explains non-steerable queue behavior.
- **QoL comfort pack** — per-session composer drafts; prompt history (↑/↓); in-transcript find (`Mod+F`); search→scroll to message; selection + user-message Copy; Allow/Deny (`Y`/`N`); turn-finished sound only when unfocused (setting); remembered access mode + per-project model/harness; “N new” jump pill; expandable composer; copy/export transcript + duplicate session; queue reorder + persist; Esc/Stop + approval chords documented in KEYBINDINGS.

## Windows agent session (machine-local)

These notes describe the Warexpor Windows PC that proved a live Claude session. They are product-operator rules, not proof that this cloud VM ran a session.

- Prefer OpenCodex (`ocx`) on `127.0.0.1:10100` with model `claude-opus-4-8-20261030` when that helper is installed locally.
- Do not send harness traffic through a SOCKS or HTTP outbound proxy on `:10808`.
- Prefer `opencode-go` over a poisoned `sk-proxy` or `:8090` Claude gateway.
- Token `monocode-windows-ok` is machine-local. Do not invent API keys in cloud agents.
- `SESSION_OK` on that PC is not transferable. Linux cloud VMs cannot claim it.

Platform parity work (glass, PTY, Job Objects, PATH) belongs on `main`, not here, even when this branch is the PR target for a mixed change set.
