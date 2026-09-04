# Pull hardbeat920/monocode into local main, then report next steps.
param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

git remote get-url upstream | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Missing upstream remote. Add: git remote add upstream https://github.com/hardbeat920/monocode.git"
}

$branch = git rev-parse --abbrev-ref HEAD
Write-Host "Fetching upstream..."
git fetch upstream

$mainRef = "main"
git rev-parse --verify $mainRef | Out-Null
$behind = git rev-list --count "${mainRef}..upstream/main"
$ahead = git rev-list --count "upstream/main..${mainRef}"
Write-Host "main vs upstream/main: ahead=$ahead behind=$behind"

if ($DryRun) {
  Write-Host "Dry run. No checkout, no merge."
  if ($behind -eq 0) {
    Write-Host "Already contains upstream/main."
  } elseif ($ahead -eq 0) {
    Write-Host "Would fast-forward main to upstream/main ($behind commits)."
  } else {
    Write-Host "Would merge upstream/main into main (divergent)."
  }
  Write-Host "Current branch is $branch"
  exit 0
}

Write-Host "Checking out main..."
git checkout main

if ($behind -eq 0) {
  Write-Host "Already contains upstream/main. Nothing to merge."
} elseif ($ahead -eq 0) {
  Write-Host "Fast-forwarding main to upstream/main..."
  git merge --ff-only upstream/main
} else {
  Write-Host "Merging upstream/main into main (divergent history)..."
  git merge upstream/main --no-edit
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Merge conflicts. Resolve, then npm ci; npm run check; npm run build:windows"
  }
}

Write-Host ""
Write-Host "main is at $(git rev-parse --short HEAD)"
Write-Host "Previous branch was $branch"
Write-Host "If you use custom/* branches, merge or rebase main into them next."
Write-Host "Then: npm ci; npm run check; npm run build:windows"
