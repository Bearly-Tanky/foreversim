# Verification: what to run, and what each gate actually catches

**Source of truth:** the `scripts` block in `package.json` and `.github/workflows/run_tests.yml`.
Never quote a command from memory; print the current list:

```
node -e "console.log(require('./package.json').scripts)"
```

## Before you call a UI change done

```
npm run type-check     # node_modules/typescript/bin/tsc --noEmit — the whole repo, tools/ included
npm run lint:js        # npx oxlint --max-warnings 0 ./ui
npm run lint:css       # stylelint "./ui/**/*.css"
npm run fmt            # npx oxfmt . --check — the whole repo, not just ui/
npm run test:unit      # vitest run — happy-dom, ui/**/*.test.ts(x)
npm run test:locales   # ajv, assets/locales/** against schemas/**
```

That is every script this tree has. **There is no `test:snapshots` script** — the golden harness it
would run is developer-local and absent here; see "The snapshot harness" below, and read anything
elsewhere in this skill that says "`npm run test:snapshots` covers X" as "the harness covers X, if
you have it".

`npm run lint:js` runs with `--max-warnings 0`, so a warning fails it exactly like an error. Note
that oxlint 1.77 prints **nothing at all** on a clean run: an empty output with exit 0 is a pass,
not a misconfigured invocation.

Add `npm run test:locales` whenever you touched `assets/locales/**` or `schemas/**`, and
`npm run lint:css` (stylelint over `ui/**/*.css`) whenever you touched a stylesheet. There is no
SCSS left in the tree.

What each one is actually for:

| Gate             | Catches                                                                                                                    | Does not catch                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `type-check`     | broken specifiers, alias mismatches, spec-config shape drift                                                               | a legal import that violates the layer direction                                |
| `lint:js`        | layer violations (`no-restricted-imports`), browser globals in `ui/sim` and feature models, hook-rule breaks, import order | anything not listed in `.oxlintrc.json` — `categories.correctness` is **off**   |
| `test:unit`      | component and helper behaviour, the store hooks' gating, and the two tree-wide gates below                                 | anything without a `.test.ts(x)` beside it, and warnings — see the last section |
| `test:locales`   | a locale key with no matching property in its `additionalProperties: false` schema                                         | a key the schema allows and no locale file defines                              |
| `test:snapshots` | (no script here) the store notification contract, then serialization drift across all 17 specs                             | rendering                                                                       |
| `fmt`            | formatting across the repo, markdown included — `assets/**` and `**/test-fixtures/*.json` are the ignored trees            | anything `.gitignore` already hides, which is how generated output escapes it   |

**Zero `no-restricted-imports` errors is the bar**, not "no new ones": the layer rules are the whole
point of the current tree, and `lint:js` is the only thing enforcing them anywhere.

## What CI runs

`.github/workflows/run_tests.yml` has two jobs:

- **`build-ui`**: `npm ci` and `test:locales`, then `fmt`, `lint:js`, `lint:css`, a
  `make ui/generated/proto/api.ts go-to-ts` generate step, `type-check`, `test:unit`, and finally
  `make dist/forever/.dirstamp`.
- **`test`**: four shards of `go test --tags=with_db ./sim/...` — the Go sim, not the UI.

So every script in the list above runs in CI, cheapest first, which is why a formatting slip reports
in about a minute instead of behind the wasm build. The generate step has to come before `type-check`
because `ui/generated/proto/**` and `ui/sim/wasm/bulk_sim/constants_auto_gen.ts` are gitignored and
absent from a fresh checkout; the other three `*_auto_gen.ts` are tracked.

`make dist/forever/.dirstamp` is not a thin wrapper: through `dist/forever/bundle/.dirstamp` it runs
`tsc --noEmit`, `npx tsx vite.build-workers.mts` and `npx vite build`, and it also builds
`dist/forever/lib.wasm.gz`, `ui/generated/proto/api.ts` and the asset copies — so the build type-checks
a second time, through make, never by calling `vite build` directly.

Two of `test:unit`'s files are tree-wide gates rather than component tests, and they are the only
thing enforcing what they check: `ui/canonical_classes.test.ts` (no non-canonical Tailwind tokens,
no `var(...)` inside a class token) and `ui/no_class_hooks.test.ts` (no class hooks, no retired
vanilla class names, no `[data-testid]` styling). Both run under `// @vitest-environment node` —
they read the tree off disk and need no DOM — and both read data files beside them,
`ui/retired_class_names.json` and `ui/class_hook_allowlist.json`.

**The one thing CI does not run is the snapshot harness**, which is developer-local and not on this
tree at all. A golden diff still reaches master green.

`build-ui` is reused through `workflow_call` by `deploy.yml` and `release.yml`, both with
`needs: tests`, so every gate above also blocks a deploy and a release.

Read the current job list rather than trusting this section:

```
RTK_DISABLED=1 /usr/bin/grep -n "name:\|run:" .github/workflows/run_tests.yml
```

## Warnings are invisible unless you ask for them

vitest intercepts console output, so React and Base UI warnings do not reach stdout on a normal run
— `npm run test:unit` can be entirely green while the suite emits hundreds of them. They surface in
CI logs and nowhere else, which makes them look like a CI-only phenomenon. They are not:

```
RTK_DISABLED=1 npx vitest run --disableConsoleIntercept 2>&1 | grep -c "not wrapped in act"
```

Three counts worth keeping at zero, all of which were nonzero the first time anyone looked here:

- `not wrapped in act` — a state update landing outside an act window. Usually a promise resolving
  after the test body, or a store notify called bare between acts.
- `overlapping act` — the failure mode introduced by fixing the first one carelessly.
- `Base UI:` — the `nativeButton` contract, among others.

**Prefix `RTK_DISABLED=1` on anything whose output you grep for a count**, not just git. RTK rewrites
dev commands too, and a compressed one-line summary greps as zero — indistinguishable from success.

If a flag the count depends on might be silently ignored, pass a deliberately bogus one first:
`--disableConsoleInterceptXYZ` fails with ``CACError: Unknown option `--disableConsoleInterceptXYZ` ``,
so a clean run proves the real flag was accepted rather than dropped.

**Do not attribute a warning from its position in the output.** Workers write to a shared stdout, so
a warning header from one file routinely lands next to a stack frame from another — two sites were
misread that way before this was noticed, and `--no-file-parallelism` does not fix it either, because
the reporter's file markers and the console writes are separate streams. Bisect instead: run a
directory, then a file, then `-t 'test name'`, and read the count.

```
for f in ui/features/settings/model/*.test.ts*; do
  printf '%-48s ' "$f"
  RTK_DISABLED=1 npx vitest run "$f" --disableConsoleIntercept 2>&1 | grep -c 'not wrapped in act'
done
```

## Locales

`npm run test:locales` runs `test-locales.mjs`, which compiles each `schemas/<name>.schema.json`
with ajv and validates every `assets/locales/**/<name>.json` against it. Today that is `character`,
`talents` and `translation` — TBC ships only `assets/locales/en/`, no second locale. There is no
`glyphs` schema or locale file (TBC's proto has no `Glyphs` message). `gear.schema.json` exists but
matches no locale file, so it validates nothing; `assets/locales/en/updates.json` has no matching
schema either, so it is never validated by this script.

**Every schema sets `additionalProperties: false`**, so a new locale key needs a matching property in
`schemas/<name>.schema.json`. Skip the schema and CI fails on the very first job. Verify the
constraint rather than trusting it:

```
node -e "const j=require('./schemas/translation.schema.json'); const s=new Set(); (function w(o){if(!o||typeof o!=='object')return; if('additionalProperties' in o) s.add(String(o.additionalProperties)); for(const k in o) w(o[k]);})(j); console.log([...s])"
```

## The snapshot harness

**`tools/state-snapshots/` is developer-local and not tracked** (a line in `.git/info/exclude`
here, ahead of the harness itself landing — it is absent from this checkout). `test:snapshots` /
`test:snapshots:update` are not yet `package.json` scripts on this tree — check
`node -e "console.log(require('./package.json').scripts)"` before quoting either. Once they exist,
expect the same shape as the source port: they do nothing in a fresh clone, and the 17/17 figure a PR
quotes cannot be reproduced by a reviewer who does not have the harness, because it stays local —
`golden.json` is a multi-MB fixture and regenerating it is a fixture update, which only the repo
owner does. The `virtual:i18next-loader` alias the unit tests need should be a separate, **tracked**
file (`tools/vite/stub-i18n.js`), so `npm run test:unit` works in a fresh clone regardless.

`check.mjs` runs two passes, both as vite SSR builds into `tmp/harness/`
executed under happy-dom by `run.mjs` (which stubs `Worker` and serves `/forever/assets/**` from the
checkout so `Database.get()` loads the real `db.bin`):

1. **`store-contract-test.ts`** first, fast-fail. It asserts the notification contract: one gated
   subscriber fire per facade write, equal-value writes suppressed, unconditional setters still
   notifying via version counters, `batch()` deferring to one fire with final state, the aggregate
   and composition selectors, the satellites, `Emitter`, `setGearAsync`. Nothing else runs if this
   fails.
2. **`snapshot.ts`** — for every launched spec, build `Sim` + `Player` in node, apply defaults,
   serialize player / sim / raid / encounter, and compare byte-for-byte against `golden.json`. It
   also asserts `fromProto(toProto(x))` is a fixed point per spec.

Quirks it encodes **on purpose** — do not "fix" them:

- `Sim.toProto` collapses all-selected filter arrays to `[]`; `Sim.fromProto` re-expands them, so
  the form is only a fixed point from the second pass and the harness canonicalizes once first.
- `Sim.fromProto` mutates its **argument** in place. Serialize before round-tripping.
- `sim.waitForInit()` never resolves under the stubbed `Worker` (it probes for wasm). Await
  `Database.get()` instead.
- `applySpecDefaults` in `snapshot.ts` mirrors `IndividualSimUI.applyDefaults` minus the UI-owned
  satellites. When defaults application moves into `ui/sim/state/`, replace the mirror with the real
  implementation — the snapshot diff then verifies the move.

`npm run test:snapshots:update` regenerates `golden.json`. **Never run it to make a red gate green,
and never commit a regenerated golden without asking** — diff the old and new JSON and confirm only
the fields you intended moved. The same rule covers every fixture in this repo.

Because the harness builds the real module graph, it is also the gate that catches a
module-evaluation-order cycle (see `layers.md`) — that failure looks like a crash in `new Player`.

## What no gate covers

Rendering, layout and interaction. None of the five commands above constructs the shell —
`tools/state-snapshots/snapshot.ts` imports `IndividualSimUIConfig` as a _type_ and mirrors
`applyDefaults` by hand, so the goldens prove no state write leaked into a component and say nothing
about whether anything rendered.

**Nothing above proves the page rendered.** The goldens are a state contract, not a render check, so
a change that only moves DOM or CSS around can pass every command here. When a change touches
rendering, layout or interaction, drive the built page yourself — build it, serve it, and compare
against a build of the parent commit rather than against a remembered element count. Say in the PR
what you ran or what you clicked.

`tools/browser-perf/` (perf timings) is **untracked**: it exists wherever its owner made it and
nowhere else — not in a fresh clone and not in CI. It is not in this clone's `.git/info/exclude`
today (only `tools/state-snapshots/` is), and that file is never committed anyway: it lives in the
shared common git dir, so a rule in it applies to every worktree of this clone and travels with none
of them. Check before relying on it (`/usr/bin/ls tools/browser-perf/`) and do not tell anyone else a
path is there.

## A fresh checkout needs generated files first

`npm run type-check` and every build need files that are gitignored and produced by Go tooling:
`ui/generated/proto/*` (`make ui/generated/proto/api.ts`) and the `*_auto_gen.ts` files
(`make go-to-ts`, which runs `go run ./tools/database/gen_db -gen=go-to-ts`) — today three:
`ui/sim/player/classes/capabilities_auto_gen.ts`, `ui/sim/bulk/constants_auto_gen.ts` and
`ui/sim/wasm/bulk_sim/constants_auto_gen.ts`. Copying them from a built checkout works and is
faster. Never run `gen_db` concurrently with another copy of itself.

The wart to watch for is a `AUTO_GEN_FILES_TS` entry the generator does not actually write: a stale
path there makes the prerequisite never appear, so every `make` that depends on it re-runs `gen_db`
and re-bundles even when nothing changed. After the restructure the three agree — deleting all
three and running `make go-to-ts` brings back byte-identical copies, and a second `make go-to-ts`
then says "Nothing to be done". Re-derive rather than trusting this paragraph:

```
/usr/bin/grep -n AUTO_GEN_FILES_TS makefile | head -1
/usr/bin/grep -rn 'constants_auto_gen.ts\"\|capabilities_auto_gen.ts\"' tools/database/
```

A fourth generated TS file, `ui/sim/constants/missing_effects_auto_gen.ts`, is _not_ in that list and
is not written by `-gen=go-to-ts`: `tools/database/gen_effects.go` emits it during full database
generation, which needs `assets/db_inputs`. `ui/features/gear/item_notices.tsx` imports it, so a
checkout without it fails `type-check`. That has always been true here — master has the same
arrangement at the pre-port path — so copy the file in rather than trying to regenerate it.
