#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Missing upstream remote. Add: git remote add upstream https://github.com/hardbeat920/monocode.git" >&2
  exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)
echo "Fetching upstream..."
git fetch upstream

behind=$(git rev-list --count main..upstream/main)
ahead=$(git rev-list --count upstream/main..main)
echo "main vs upstream/main: ahead=$ahead behind=$behind"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run. No checkout, no merge."
  if [[ "$behind" -eq 0 ]]; then
    echo "Already contains upstream/main."
  elif [[ "$ahead" -eq 0 ]]; then
    echo "Would fast-forward main to upstream/main ($behind commits)."
  else
    echo "Would merge upstream/main into main (divergent)."
  fi
  echo "Current branch is $branch"
  exit 0
fi

echo "Checking out main..."
git checkout main

if [[ "$behind" -eq 0 ]]; then
  echo "Already contains upstream/main. Nothing to merge."
elif [[ "$ahead" -eq 0 ]]; then
  echo "Fast-forwarding main to upstream/main..."
  git merge --ff-only upstream/main
else
  echo "Merging upstream/main into main (divergent history)..."
  git merge upstream/main --no-edit
fi

echo
echo "main is at $(git rev-parse --short HEAD)"
echo "Previous branch was $branch"
echo "If you use custom/* branches, merge or rebase main into them next."
echo "Then: npm ci; npm run check; npm run build:windows"
