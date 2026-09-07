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
3. Keep custom product behavior behind `src/custom/` exports when practical so upstream merges stay small.

## Windows agent session (machine-local)

These notes describe the Warexpor Windows PC that proved a live Claude session. They are product-operator rules, not proof that a cloud VM ran a session.

- Prefer OpenCodex (`ocx`) on `127.0.0.1:10100` with model `claude-opus-4-8-20261030` when that helper is installed locally.
- Do not send harness traffic through a SOCKS or HTTP outbound proxy on `:10808`.
- Prefer `opencode-go` over a poisoned `sk-proxy` or `:8090` Claude gateway.
- Token `monocode-windows-ok` is machine-local. Do not invent API keys in cloud agents.
- `SESSION_OK` on that PC is not transferable. Linux cloud VMs cannot claim it.
