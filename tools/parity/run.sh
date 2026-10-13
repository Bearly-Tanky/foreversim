#!/usr/bin/env bash
# Switch-gate parity check: every arena spec on master and on forever-next, same talents,
# same bonus stats and weapons, same target (tools/parity/specs.json). Prints DPS per spec
# and the gap.
#
#   tools/parity/run.sh [master-checkout]
#
# With no argument it checks origin/master out into a temporary worktree (and generates its
# Go protos). Run from a forever-next checkout whose own Go protos are generated.
# PARITY_ITERATIONS (default 2000) sets the iterations per spec. PARITY_GEAR=1 runs each
# spec in its default gear preset (specs.json "gear") on both engines instead of the profile.
# PARITY_ONLY=a,b limits the run to those specs. PARITY_DETAIL=1 adds per-action DPS, crit
# and partial-resist rates, damage per hit, aura uptimes and resource gains. PARITY_LOG=<dir>
# writes both engines' combat logs there (use with PARITY_ITERATIONS=1).
# PARITY_SEED=<n> changes the random seed (default 101), for logs of other runs.
# PARITY_REACTION=<ms> sets forever-next's reaction time (default 150; master polls every 50).
# PARITY_STAGES=1 prints each spec's stats per stage (base, gear, talents, buffs, consumes,
# final) and its active set bonuses on both engines, for chasing a stat gap.
set -euo pipefail

next=$(git rev-parse --show-toplevel)
iterations=${PARITY_ITERATIONS:-2000}
out=$(mktemp -d)

master=${1:-}
if [ -z "$master" ]; then
	master="$out/master"
	git -C "$next" fetch -q origin master
	git -C "$next" worktree add -q --detach "$master" origin/master
	trap 'git -C "$next" worktree remove --force "$master"' EXIT
fi
if [ ! -f "$master/sim/core/proto/api.pb.go" ]; then
	(cd "$master" && npx --yes @protobuf-ts/protoc@2.9.1 -I=./proto --go_out=./sim/core ./proto/*.proto)
fi

cp "$next/tools/parity/master_parity_test.go.in" "$master/sim/zz_parity_test.go"
(cd "$master" && PARITY_OUT="$out/master.json" PARITY_SPECS="$next/tools/parity/specs.json" \
	PARITY_ITERATIONS=$iterations go test --tags=with_db ./sim -run '^TestParity$' -count=1 -timeout 60m -v | grep -v -e '^=== ' -e '^--- PASS' -e '^PASS' -e '^ok') || true
rm -f "$master/sim/zz_parity_test.go"

cd "$next" && PARITY_MASTER="$out/master.json" PARITY_ITERATIONS=$iterations \
	go test --tags=with_db ./tools/parity -run '^TestParity$' -count=1 -v -timeout 60m
