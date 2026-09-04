# Warexpor custom layer

This branch (`custom/warexpor`) is where product-specific changes live.

Rules:
1. Do not rewrite `main` history.
2. Keep Windows/platform fixes on `main` (or `feat/windows`) so they merge cleanly with upstream.
3. After `.\scripts\sync-upstream.ps1`, merge `main` into this branch and resolve custom conflicts here.
4. Prefer additive modules under `src/custom/` (or agreed paths) over editing core harness files when possible.

Status: scaffold only. Feature work starts when the product brief lands.
