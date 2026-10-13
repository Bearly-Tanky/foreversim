# ui/ layout

Styling, state, and how to locate elements in tests/tools are `STYLING.md`, not here.

The tree:

```
ui/
  worker/            NOT MOVED (Go package, go:embed highs.wasm). alias @worker
  generated/         proto/*, *_auto_gen.ts — tool output only. alias @generated
                     (*_auto_gen.ts still sit beside their consumers)
  sim/               DOM-free, node-runnable model, grouped by subject: sim.ts + sim_host.ts +
                     sim_runs.ts + sim_signal_manager.ts + spec_config.ts at the root, then
                     player/ (player, player_class, player_spec, classes/, specs/),
                     raid/ (raid, party, encounter), settings/ (bulk, item_swap, reforge,
                     stat_weight), utils/ (collections, math, format, json, misc),
                     workers/, cache/, state/, proto/, talents data + trees, bulk/,
                     wasm/, constants/, presets/, hooks/, context/. alias @sim
  ui-kit/            sim-agnostic React widgets, one folder per component (about 45 of them:
                     NumberPicker/, Dialog/, Tooltip/, VirtualList/, …), plus hooks/,
                     utils/ (css, dom, wowhead), and the flat helper modules the configs use:
                     input.ts, input_helpers.ts, icon_inputs.ts, child_props.ts,
                     sidebar_registry.ts, tab_activation.ts. alias @ui-kit
  features/<name>/   one folder per capability: model/ (DOM-free, lint-enforced) +
                     components/ (React, one folder per component) + hooks/ + utils/ (feature
                     helpers that are neither a component nor DOM-free). The twelve are
                     apl, bulk, character-stats, encounter, gear, import-export, item-swap,
                     reforge, results, settings, stat-weights, talents. alias @features
  features/hooks/    React hooks several features share and none owns (useSavedPanel), one
                     per file, beside the twelve capability folders
  app/               shells + chrome that compose features, and the only place allowed to
                     import react-dom/client (spec_entry.tsx). SimApp/SimShell/SimTabs,
                     tabs/ (a React <X>TabBody per tab), header/, SettingsDialog/,
                     PresetConfigurationPicker/, the sidebar and import/export pieces,
                     shell_classes, browser_env, known_issues, preset_utils, and
                     individual_sim_ui.tsx — the host object the React tree reaches through
                     useSimHost(). types/ holds app-level type modules. alias @app
  i18n/              LEAF: framework-agnostic i18next config + localization tables
                     (config.ts, entity_mapping.ts, locale_service.ts, localization.ts), at
                     the top level rather than under app/. alias @i18n
  specs/<class>/<spec>/   spec data, presets. alias @specs. No html on disk: the one page at
                     ui/index_template.html is served (dev) and emitted (build) at every
                     /forever/<class>/<spec>/ by tools/vite/spec_pages.mts
  styles/            the one CSS entry (style.css), theme/ (tokens + the 17 spec themes, split by
                     type: colors.css, spacing.css, breakpoints.css, typography.css, effects.css,
                     z-index.css, vars.css, specs.css, imported via index.css),
                     base.css (element defaults), vendor.css (third-party-only selectors) — see
                     STYLING.md. No SCSS and no Bootstrap remain anywhere in ui/
  index.html          the landing page, a React tree mounted by app/landing_entry.tsx on #root.
                     Its components are in app/landing/
  shared/            two browser helpers: page_boot.ts, pointer.ts (DOM helpers a component
                     reaches for are ui-kit/utils/dom.ts)
  testing/           tailwind/ — the canonical-class and class-hook checkers, run as node scripts
  types/             ambient .d.ts (i18n-loader.d.ts)
  index_template.html, tracking/   root, unchanged
```

## JSX

Every `.tsx` file is React (`tsconfig.json` is `jsx: react-jsx` / `jsxImportSource: react`, and both
vite configs use the automatic runtime). There is no second dialect and no per-file pragma.

Shared React components get a folder of their own, `ui-kit/<Name>/{<Name>.tsx, types.ts, index.ts}`,
plus a co-located `<Name>.css` only when the component needs `ui-*` composition classes (see
`STYLING.md`) — most style with Tailwind utilities inline and have no `.css` file at all. Hooks live one per file named after
the hook: the store's React binding and everything built on it in `ui/sim/hooks/`
(`useStoreSubscribe.ts`, `useSimRun.ts`), the sim-agnostic ones in `ui-kit/hooks/` (`useInput.ts`,
`useActionId.ts`). There is no `ui-kit/react/`: every component here is React, so the qualifier
distinguished nothing. There is no separate component-registry document — components and their
co-located CSS are covered here and in `STYLING.md`.

## Placement rules

- `sim/`: if it needs `window`/`document`, it doesn't belong here — inject an `Env` adapter instead.
- `ui-kit/`: reusable widgets with zero knowledge of sims (no `Player`/`Sim` types except through generic params).
- `features/<x>/model/`: DOM-free logic of one capability, and framework-free — no React, not even as a type. `features/<x>/components/`: its React components, and beside them the imperative helpers that
  touch the DOM without being components — the timeline's chart builders, zoom controllers and
  ruler sit in `results/components/Timeline/{chart,rotation}/`. The two may share a name:
  `results/model/timeline/` and `results/components/Timeline/`.
- `app/`: composes features; the only place that knows the tab layout.
- `specs/<class>/<spec>/`: data; the only code allowed is `features/` escape hatches and `shared/derived.ts` rules.

## Dependency direction

```
generated → worker → {sim, i18n} → ui-kit → features → app → specs → pages
```

`ui/sim` and `i18n` are peers: both are leaves everything above them may depend on, and each
may depend on the other (i18n's entity/status label maps name sim enums; sim in turn calls
into i18n for label lookups). Each layer may only import from layers to its left. `.oxlintrc.json` enforces this with
`no-restricted-imports` on the alias forms (see overrides for `ui/sim/**`, `ui/ui-kit/**`,
`ui/features/**`, `ui/app/**`), plus `no-restricted-globals` (window/document/localStorage/
location/navigator) on `ui/sim/**` and `ui/features/*/model/**`.

The `no-restricted-imports` groups use `**` (not `*`): oxlint matches these patterns one
path segment at a time, so `@features/*` would not catch `@features/reforge/model/reforge_optimizer`.
`ui/features/**` may not import the store writers (`patchSlice` / `patchKeyed` / `seedKeyed` /
`deleteKeyed`) — go through a facade.

Features, ui-kit and sim must not name the app host (`SimHostObject`) even as a
type: `import type` is erased at runtime but the lint bans the specifier either way. They use
narrow host interfaces instead — all of them in `@sim/sim_host`: `SimWarning`, `SimHost`,
`IndividualSimHost<Spec>`, plus the `isIndividualSimHost()` predicate that replaces
`instanceof SimHostObject`. The
host declares `implements IndividualSimHost` so the interfaces stay honest. The per-spec config schema lives in `@sim/spec_config` (`IndividualSimUIConfig`,
`InputSection`, `OtherDefaults`, `Settings`, `registerSpecConfig`, `itemSwapEnabledSpecs`). It names
ui-kit picker configs, so it reaches them through `import type` only — a value import would be a
layer violation. `ui/sim/spec_config.ts` and `ui/sim/sim_host.ts` (for `SidebarRegistry`) are the
only files in `ui/sim` that name `@ui-kit`, both type-only.
It also holds the declarative spec surface (`SpecDefinition`, `SpecBehaviors`, `DerivedSetting`,
`CustomSection`, `defineSpec` — see "How to author a spec"); `app/individual_sim_ui.tsx` re-exports all of it as a
convenience. The preset shapes
(`PresetGear`, `PresetEpWeights`, …) live in `ui/sim/presets/types.ts`; `app/preset_utils.ts`
holds the `make*` builders and re-exports the types.

Proto-serialisable preset data lives as JSON, never as a TS literal: gear (`gear_sets/*.gear.json`),
APLs (`apls/*.apl.json`), builds (`builds/*.build.json`), EP weights (`presets/ep/*.ep.json`) and
talents (`presets/talents/*.talents.json`) under `ui/specs/<class>/<spec>/`. EP JSON stores enum
fields by name (e.g. `"StatCritRating"`) rather than numeric value, so the file stays stable across
proto regenerations; `PresetUtils.makePresetEpWeightsFromJSON` resolves the names back through the
enum (`Stat`/`PseudoStat`) and builds the preset the same way the old literal call did. TBC's
`SavedTalents` proto is a single `talentsString` field — there is no per-talent enum to resolve, so
`makePresetTalentsFromJSON` just wraps the string. Anything that references a TS symbol or a
callback (a computed EP preset built from another via `.withStat()`, an `onLoad` handler) stays a
TS literal instead.

`@i18n/*` resolves into `ui/i18n/*`, a top-level leaf (not owned by `app/`) — sim, ui-kit and
features reach it through that alias. `ui/i18n/**/*.{ts,tsx}` has its own `no-restricted-imports`
override banning `@app`/`@features`/`@ui-kit`/`@specs/**` (`@sim` is allowed).

## Aliases

| Alias          | Resolves to      |
| -------------- | ---------------- |
| `@sim/*`       | `ui/sim/*`       |
| `@generated/*` | `ui/generated/*` |
| `@worker/*`    | `ui/worker/*`    |
| `@ui-kit/*`    | `ui/ui-kit/*`    |
| `@features/*`  | `ui/features/*`  |
| `@app/*`       | `ui/app/*`       |
| `@specs/*`     | `ui/specs/*`     |
| `@i18n/*`      | `ui/i18n/*`      |

Configured via `tsconfig.json` (`paths`) and `resolve.alias` in `vite.config.mts`
(`getBaseConfig`, inherited by worker builds) and `vite.harness.mts`. Node's `package.json`
`imports` field was tried first but rejected: `tsc` under `moduleResolution: "bundler"` does not
resolve `#foo/*` subpaths (it only works under `node16`/`nodenext`, and even then requires an
explicit extension on every specifier).

## How to author a spec

A spec is data. `ui/specs/<class>/<spec>/spec.ts` default-exports one `defineSpec({...})` call and is
the only code file the spec owns (besides `presets.ts` / `inputs.ts`):

```ts
import { defineSpec } from '@sim/spec_config';

export default defineSpec<Spec.SpecDpsWarrior>({
    spec: Spec.SpecDpsWarrior,          // identity
    className, cssScheme, epStats, displayStats, …,  // everything IndividualSimUIConfig declares
    defaults: { … },
    presets: { … },
    reforge: { getEPDefaults, updateSoftCaps },      // optional — wires ReforgeOptimizer
    enableHealing: false,                            // optional — overrides the tank/healer default
    derivedSettings: [{ subscribe, apply }],         // optional — settings derived from others
    features: [registerThing],                       // optional — spec-local escape hatch
});
```

`SpecDefinition` is `IndividualSimUIConfig` plus `spec` plus the optional `SpecBehaviors`
(`reforge`, `enableHealing`, `derivedSettings`, `features`) — the four things spec constructors
used to do by hand. `defineSpec` is an identity function; it exists only so the object is
checked without an annotation that would widen the literal spec type. Pass the spec as an
explicit type argument so `Player<Spec.SpecX>` callbacks keep their narrow type.

### Custom settings sections

A custom section is data, never DOM. A spec that needs an extra block on the settings tab
declares it as a `CustomSection` in `sections`, and `app/tabs/SettingsTabBody.tsx` renders each
one through `<CustomSection>` (`@features/settings`) -- the same `ContentBlock` + picker path the
standard sections use:

```ts
sections: [{
    id: 'totems',                                    // ContentBlock css class when className is unset
    title: 'Totems',
    tooltip: '…',                                    // optional — header tooltip button
    className: 'my-custom-section',                   // extra utility classes on the block
    iconGroupClassName: 'totem-dropdowns-container', // layout hook for the icon row
    iconInputs: [ … ],                               // same configs as `playerIconInputs`
    inputs: [ … ],                                   // same configs as `otherInputs.inputs`
    when: player => …,                               // optional — hides the section, like `showWhen`
}],
```

`iconInputs` land in a `picker-group icon-group` container above `inputs`, and every
`.input-root` in the body then gets `input-inline` — exactly what the Other Settings block does.
`when` is re-evaluated on `subscribePlayerChange`. `sections` is the only shape; the older
`customSections` (an array of functions returning a `ContentBlock`) has been deleted.

`reforge` may also be a function of the sim host, for options that need to call back into it.
The `getEPDefaults` / `updateSoftCaps` callbacks receive `(…, player, ctx)` where
`ctx = { player, reforger, defaults }` — that is how a spec reads `ctx.reforger.preCapEPs` or
`ctx.defaults` without a `this`.

### The entry flow

`ui/app/spec_entry.tsx` is the single page entry for every spec, referenced from
`ui/index_template.html`. It derives the module key from `location.pathname`
(`/forever/<class>/<spec>/` → `../specs/<class>/<spec>/spec`), loads it from a lazy
`import.meta.glob('../specs/*/*/spec.{ts,tsx}')` — `.tsx` only for a spec module that carries real
JSX, which today is **none of TBC's 17**. (Of the two pre-port `.tsx` spec files, mage/dps's carried
no JSX at all and warlock/dps's only JSX was `appendChild(<p>)` / `(<></>) as HTMLElement`
tsx-vanilla DOM construction that the React port replaced outright; neither file survives.)
Default every spec to `.ts` — so each spec ships its own chunk and only the
visited one is fetched — then:

```
registerSpecConfig(def.spec, def)  →  new Sim  →  new Player  →  (enableHealing)  →
sim.raid.setPlayer  →  new SimHostObject(shellDom, player, def)
```

**Ordering constraint:** `registerSpecConfig` must run _before_ `new Player()`, which resolves
the spec's config out of the registry in its own constructor. This is the only place that
ordering matters, and `spec_entry.ts` is the only place it is expressed.

`SimHostObject` is concrete — a spec does not subclass it. Its constructor takes a
`SpecDefinition<S>`, and runs the behaviour slots (features → reforge → derivedSettings) as its
last statements, exactly where a subclass constructor body used to run. `derivedSettings` runs
`apply` once there (before defaults load, mirroring the old constructor timing) and then again
whenever `subscribe`'s source fires — including when the defaults land.

All 17 specs are converted: there is no `sim.ts`, no per-spec `index.ts` and no
`SimHostObject` subclass anywhere. Adding a spec is:

1. `ui/specs/<class>/<spec>/spec.ts` (or `.tsx`) default-exporting `defineSpec({...})`, plus its
   `presets.ts` / `inputs.ts`.
2. An entry in `ui/sim/player/specs/index.ts`, i.e. a `PlayerSpec` class (in
   `ui/sim/player/specs/<class>.ts`) with a `launch: { phase, status }` field — this is the
   single source of truth for launch status, read by the sim dropdown and the landing page
   (`ui/app/landing/` renders the landing page's sim links from `PlayerSpecs`, no hand-written
   list; a class row's badge is the roll-up of its specs', in `landing_classes.ts`).
3. A theme block in `ui/styles/theme/specs.css`. TBC's pre-port per-spec `_sim.scss` sets a
   `--theme-color` shared per class but its own background image per spec (`dps-warrior` and
   `protection-warrior` use different files) — 17 blocks, not one reused per class. This is the
   same split the source port uses: `--theme-color`/`--theme-color-foreground` in selector lists
   grouped by class, then one `--theme-background-image` rule per spec. A new spec needs both.

The page itself is not one of the steps: there is no per-spec `index.html`, in the source tree or
anywhere else. `ui/index_template.html` is the _one_ spec page, and `tools/vite/spec_pages.mts`
(the `spec-pages` vite plugin) puts it at all 17 URLs — `configureServer` answers
`/forever/<class>/<spec>/` and `.../index.html` with it through `transformIndexHtml` in dev, and a
`post` `generateBundle` takes the page vite already processed, drops its own output path from the
bundle, and re-emits it as `<class>/<spec>/index.html` for every spec. Both halves discover the
spec list from `ui/specs/*/*/spec.ts(x)` (`discoverSpecPages`) — the same glob `PAGE_INDECES` used
before the makefile stopped generating pages — and `spec_entry.ts`'s `import.meta.glob` then picks
the spec module up from the URL. A new spec's page therefore appears with no build-config edit.

Copying one page 17× is only sound because the page is constant: `ui/index_template.html` carries
no `@@CLASS@@`/`@@SPEC@@` placeholders and every asset reference is root-absolute
(`/styles/style.css`, `/app/spec_entry.tsx`, `/i18n/localization.ts`), so vite rewrites them all to
`/forever/...` and nothing in the built page depends on where it is served from. It is also the reason
the 17 pages share one entry chunk (`bundle/spec_entry-<hash>.entry.js`, from the `spec_entry` key
in `rollupOptions.input`) instead of the 17 near-identical ones the old per-page inputs produced.
`ui/i18n/localization.ts`'s `extractClassAndSpecFromDataAttributes`
derives class/spec from `location.pathname` the same way `specModuleKey` does above, falling back
to `data-class`/`data-spec` attributes only if present. It is the spec page's path only: the landing
page translates through `i18n.t` as it renders and calls `updateLandingPageMetadata` for its title
and `<meta name="description">`.

Anything shared by several specs of the same class lives in `ui/specs/<class>/shared/`, under a
fixed name: `inputs.ts` for the input configs that would otherwise sit at the pre-port
`<class>/inputs.ts`, and `presets.ts` for encounter presets, EP-breakpoint tables and a class's
`DefaultRaidBuffs` where its specs share one raid-buff default. Only the classes that need it have
the directory — today `shaman/shared/inputs.ts` and `warrior/shared/{inputs,presets}.ts`; druid's
four specs and paladin's three share nothing at this level, so there is no `druid/shared/` or
`paladin/shared/`.

If a rule ever has to be shared as a `DerivedSetting`, declare it `DerivedSetting<any>`: `Player<S>`
is invariant in `S`, so a rule typed against a spec union is not assignable into any one spec's
`derivedSettings`. Annotate the callback parameters to keep the bodies checked.

## How to move a file

There is no move tool. Move by hand with `git mv` (or a plain rename for a gitignored generated
file), then repair every import specifier across `ui/` and `tools/` yourself — emit alias form when
the importer and the target end up in different top-level `ui/` directories and a relative
specifier otherwise.

Then run the gates: `npm run type-check`, `npm run lint:js` (`npm run lint:js:fix` sorts the imports
the move disturbed), `npm run fmt`, `npm run test:unit`, and `make dist/forever/.dirstamp`, which is what
CI builds — see `.github/skills/wowsims-ui/references/verification.md`.
