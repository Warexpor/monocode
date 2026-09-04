# Upstream sync

This repo is a true fork of [hardbeat920/monocode](https://github.com/hardbeat920/monocode).

| Remote | URL | Role |
|--------|-----|------|
| `origin` | `https://github.com/Warexpor/monocode.git` | Our fork |
| `upstream` | `https://github.com/hardbeat920/monocode.git` | Original MonoCode |

## Branch layout

| Branch | Purpose |
|--------|---------|
| `main` | Tracks upstream `main` as closely as practical |
| `feat/windows` | 1:1 Windows port (nonlooped PR #46 merged onto current upstream) |
| `custom/warexpor` | Warexpor product changes (`CUSTOM.md`, `src/custom/`), stacked on Windows-ready `main` |

Keep Windows and custom work out of a long-lived rewritten history. Prefer merge or rebase of `upstream/main` into our base, then replay custom commits.

## Pull upstream

From repo root (PowerShell):

```powershell
.\scripts\sync-upstream.ps1
```

Or by hand:

```powershell
git fetch upstream
git checkout main
# ff-only when we have no unique commits; otherwise merge (script does this)
git merge upstream/main
# then merge or rebase main into custom/* branches
```

## After sync

1. Resolve conflicts favoring clear platform boundaries (`#[cfg(windows)]`, path helpers).
2. Run `npm ci` then `npm run check` (or at least `npm run check:web` plus Windows `cargo test`).
3. On Windows, run `npm run build:windows` before declaring the sync good.

## Credit

Windows desktop support originally authored in [hardbeat920/monocode#46](https://github.com/hardbeat920/monocode/pull/46) by [@nonlooped](https://github.com/nonlooped).
