# Warexpor custom layer

This branch (`custom/warexpor`) is where product-specific changes live.

Rules:
1. Do not rewrite `main` history.
2. Keep Windows/platform fixes on `main` (or `feat/windows`) so they merge cleanly with upstream.
3. After `.\scripts\sync-upstream.ps1`, merge `main` into this branch and resolve custom conflicts here.
4. Prefer additive modules under `src/custom/` (or agreed paths) over editing core harness files when possible.

Status: scaffold only. Feature work starts when the product brief lands.

## Windows agent session (machine-local)

These notes describe the Warexpor Windows PC that proved a live Claude session. They are product-operator rules, not proof that this cloud VM ran a session.

- Prefer OpenCodex (`ocx`) on `127.0.0.1:10100` with model `claude-opus-4-8-20261030` when that helper is installed locally.
- Do not send harness traffic through a SOCKS or HTTP outbound proxy on `:10808`.
- Prefer `opencode-go` over a poisoned `sk-proxy` or `:8090` Claude gateway.
- Token `monocode-windows-ok` is machine-local. Do not invent API keys in cloud agents.
- `SESSION_OK` on that PC is not transferable. Linux cloud VMs cannot claim it.

Platform parity work (glass, PTY, Job Objects, PATH) belongs on `main`, not here, even when this branch is the PR target for a mixed change set.
