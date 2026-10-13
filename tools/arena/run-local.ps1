# The arena, on this machine rather than on a GitHub runner.
#
# Why it moved: a GitHub-hosted job is hard-capped at six hours, and the workflow was already
# set to 350 minutes to stay under it. The exhaustive pass does not fit in that box at any
# spec size worth doing. This host has no ceiling and four times the cores, so the long
# searches live here and CI keeps only the fast push-triggered rebuild.
#
#   .\tools\arena\run-local.ps1                    # the plain arena, every spec
#   .\tools\arena\run-local.ps1 -Optimise          # search the talent trees as well (hours)
#   .\tools\arena\run-local.ps1 -Optimise -Specs druid/balance,priest
#   .\tools\arena\run-local.ps1 -Optimise -Push    # and commit the leaderboard
#
# -Specs matches package paths (sim/druid/balance; sim/priest holds both priests), not the
# page's spec keys.
param(
    [switch]$Optimise,
    [switch]$Push,
    [string[]]$Specs,
    # One package at a time by default. Each spec's own work is parallel across every core,
    # so running fifteen packages at once only fights itself for the same sixteen.
    [int]$Parallel = 1
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
Push-Location $repo
try {
    # sim/web is a server with no arena entry and needs a generated dist stub; its presence in
    # ./sim/... is what made the first CI run fail.
    $pkgs = go list ./sim/... 2>$null | Where-Object { $_ -notmatch '/sim/web' }
    if ($Specs) {
        $pkgs = $pkgs | Where-Object { $p = $_; $Specs | Where-Object { $p -match [regex]::Escape($_) } }
        if (-not $pkgs) { throw "no packages matched: $($Specs -join ', ')" }
    }

    $env:ARENA_OUT = Join-Path $repo 'arena-out'
    # What the merge says each build was run for: sim/arenalib's iterations.
    $env:ARENA_ITERATIONS = '5000'
    $env:ARENA_OPTIMISE = if ($Optimise) { '1' } else { '' }
    New-Item -ItemType Directory -Force -Path $env:ARENA_OUT | Out-Null

    $started = Get-Date
    # -timeout 0 is the point of running here at all. -count=1 because a cached pass writes
    # nothing, and the test cache cannot know the files are the point.
    go test --tags=with_db -timeout 0 -count=1 -p $Parallel -v -run TestArena @pkgs
    if ($LASTEXITCODE -ne 0) { throw "the arena run failed" }
    Write-Host ("arena finished in {0:g}" -f ((Get-Date) - $started))

    go run ./tools/arena $env:ARENA_OUT ui/app/arena/results.json
    if ($LASTEXITCODE -ne 0) { throw "the merge failed" }

    if ($Push) {
        git add ui/app/arena/results.json
        git diff --cached --quiet
        if ($LASTEXITCODE -ne 0) {
            git commit -m 'chore(arena): rebuild the leaderboard'
            git push
        } else {
            Write-Host 'the leaderboard has not moved'
        }
    }
} finally {
    Pop-Location
}
