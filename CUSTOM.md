# Warexpor custom layer

Product overlay on Windows-ready `main`. Clone setup and sync: `UPSTREAM.md`. Windows evidence: `WINDOWS-PARITY.md`.

Additive modules live under `src/custom/`. Windows/platform fixes still land on `main`. Prefer `src/custom/` (or other agreed overlay paths) over editing core harness files when possible.

## Current modules

| Module | Role |
| --- | --- |
| `fullSetup.ts` / `FullSetupWizard.tsx` | Windows Full Setup wizard for Grok, OpenCodex, API key, model catalogs, and Exa websearch |
| `fullSetup.test.ts` | Unit coverage for recovery hints and Zen free-id heuristics |
| `index.ts` | Public exports for Settings and other chrome entry points |

The optional product branch `custom/warexpor` can diverge for larger overlay work. After `scripts/sync-upstream.sh` or `scripts/sync-upstream.ps1` updates `main`, merge `main` into that branch and resolve product conflicts there.

## Rules

1. Do not rewrite `main` history.
2. Land Windows/platform fixes on `main`, not on a stale `feat/windows` branch (`main` is ahead).
3. After `.\scripts\sync-upstream.ps1`, merge `main` into this branch and resolve custom conflicts here.
4. Prefer additive modules under `src/custom/` (or agreed paths) over editing core harness files when possible. Keep custom product behavior behind `src/custom/` exports when practical so upstream merges stay small.

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

These notes describe the Warexpor Windows PC that proved a live Claude session. They are product-operator rules, not proof that a cloud VM ran a session.

- Prefer OpenCodex (`ocx`) on `127.0.0.1:10100` with model `claude-opus-4-8-20261030` when that helper is installed locally.
- Do not send harness traffic through a SOCKS or HTTP outbound proxy on `:10808`.
- Prefer `opencode-go` over a poisoned `sk-proxy` or `:8090` Claude gateway.
- Token `monocode-windows-ok` is machine-local. Do not invent API keys in cloud agents.
- `SESSION_OK` on that PC is not transferable.
