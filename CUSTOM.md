# Warexpor custom layer

Branch: `custom/warexpor`. Clone setup and sync: `UPSTREAM.md`. Windows evidence: `WINDOWS-PARITY.md`.

This is the product overlay on Windows-ready `main`. Scaffold only until a product brief lands. Additive modules go under `src/custom/` (currently `.gitkeep`).

## Rules

1. Do not rewrite `main` history.
2. Land Windows/platform fixes on `main`, not here, even if a mixed PR is later stacked onto this branch. Do not use `feat/windows` (stale; `main` is ahead).
3. After `scripts/sync-upstream.sh` or `scripts/sync-upstream.ps1` updates `main`, merge `main` into this branch and resolve product conflicts here:

   ```bash
   git checkout custom/warexpor
   git merge main
   ```

4. Prefer `src/custom/` (or other agreed overlay paths) over editing core harness files when possible.

## Windows agent session (machine-local)

These notes describe the Warexpor Windows PC that proved a live Claude session. They are product-operator rules, not proof that a cloud VM ran a session.

- Prefer OpenCodex (`ocx`) on `127.0.0.1:10100` with model `claude-opus-4-8-20261030` when that helper is installed locally.
- Do not send harness traffic through a SOCKS or HTTP outbound proxy on `:10808`.
- Prefer `opencode-go` over a poisoned `sk-proxy` or `:8090` Claude gateway.
- Token `monocode-windows-ok` is machine-local. Do not invent API keys in cloud agents.
- `SESSION_OK` on that PC is not transferable. Linux cloud VMs cannot claim it.
