# Svelte 5 runes migration (M2c)

How LD's components were moved from Svelte-4 legacy syntax to Svelte-5 runes. This page is the
durable "do it this way next time / why these choices" layer.

## Running the codemod headlessly (the CLI hangs)
`npx sv migrate svelte-5` (and standalone `svelte-migrate`) **hang at 99% CPU in a non-TTY** —
their `@clack/prompts` busy-loop on piped stdin and never write files. Don't pipe `yes`/`echo` at
it. Instead call the migration's transform functions directly, **one child process per file with a
~30s timeout** so one pathological file can't wedge the batch.

The per-file recipe mirrors `svelte-migrate/migrations/svelte-5/index.js`:
- `.svelte`: `update_svelte_file(file, code=>code, transform_app_state_code)` then
  `update_svelte_file(file, transform_module_code, code => transform_svelte_code(code, migrate, {filename, use_ts:true}))`.
- `.ts/.js`: `update_js_file(file, transform_module_code)`.
- Import `transform_module_code`/`transform_svelte_code` from `…/svelte-5/migrate.js`,
  `transform_svelte_code` (app-state) from `…/app-state/migrate.js`, `update_svelte_file`/
  `update_js_file` from `…/utils.js`, and **`migrate` from the project's own svelte 5 compiler**
  (`site/node_modules/svelte/src/compiler/index.js` — the package's `./compiler` ESM `default`
  export; the `require` entry does NOT export `migrate`).
- Install `svelte-migrate` in a **throwaway dir outside the repo** so the committed lockfile never
  drifts. Run from there, scoped to `src`, **excluding `src/lib/svelte-pieces/`** (vendored, already
  Svelte 5 — re-running the codemod on the intentionally-legacy ShowHide/Form could break them).
- LD result: 367 files, 0 hung, 0 errored. Codemod alone: 484 warn → 121 warn, +42 type errors.

## Hand-fixes the codemod can't do (every one of these bit us)
- **`@migration-task` comment = it bailed, BUT it's advisory** — most files with the comment still
  compile. Only the one with a genuine name collision errored: a `<slot name="error">` whose name
  collides with a local `error` variable ("would change the name of a slot (error to error_1)").
  Fix: hand-migrate to runes and **rename the snippet prop** (`error` → `error_snippet`).
- **`ComponentProps<X>` → `ComponentProps<typeof X>`** (Svelte 5 wants `typeof Component`). One
  wrong instance cascades into a wall of `never`/spread/`{}` errors in dependent components.
- **`$app/stores` → `$app/state` template gap:** the codemod converts the import + `<script>` but
  leaves `$page.` in **markup**. Sweep `$page.` → `page.` in templates of every `$app/state`
  importer. (Files left on `$app/stores` still work — it's deprecated, not removed — so the codemod
  doesn't touch all of them; only fix the ones it half-converted.)
- **Email SSR was runtime-broken, not just a type error:** `render-component-to-html.ts` used
  Svelte-4's removed `component.render()`. Port the `svelte/server` `render` version (LD copied it
  verbatim from `living-dictionaries-example/site/.../render-component-to-html.ts` — it already does
  the head-style hoist + SSR-comment/empty-rule stripping).
- **Legacy HTML attrs** svelte-check now rejects on typed elements: `<td bgcolor>` →
  `{...{ bgcolor }}` (+ mirror it into `style` `background-color`); drop redundant `<img border="0">`.
- **Action event typings need the `onX` form:** a `use:`-action that `node.dispatchEvent(new
  CustomEvent('clickoutside'))` must declare `onclickoutside?` (not just `on:clickoutside`) in its
  `.d.ts` Attributes for runes consumers.
- **`unknown`/`{}` from untyped sources:** `bind:this` targets need an explicit type
  (`let el: HTMLElement = $state()`); snippet params destructured from a **legacy untyped slot**
  component (e.g. the vendored JS `ReactiveSet`) come in as `unknown` — cast with a local
  `{@const typed = value as T[]}` inside the snippet.

## Legacy slot ↔ runes snippet interop (the Slideover lesson)
A **runes** parent passing `{#snippet title()}` to a **legacy** slot component (`<slot name="title">`)
**type-errors** in svelte-check (`'title' does not exist in __sveltets_2_PropsWithChildren`), even
though it often works at runtime. Once all of a vendored slot component's consumers are runes,
**convert the component to runes snippet props** — `$$slots.x` → `if (x)`, `<slot name="x">` →
`{@render x?.()}`, default `<slot>` → `{@render children?.()}`. In a **JS** (no `lang=ts`) vendored
file, give snippet props `= undefined` defaults or they're inferred **required** (breaks every
consumer + any legacy wrapper passing them via `<svelte:fragment slot=…>`). You can keep
`createEventDispatcher` for `<X on:close>` forwarding — it's still valid in runes mode.
(Inverse caveat, from M2b: house's runes ShowHide/Form throw `invalid_default_snippet` when consumed
by a **legacy** `let:` parent → those two stay on svelte-pieces LEGACY source until their consumers
are runes.)

## each_item_invalid_assignment — only the bare identifier
The runtime error fires for `bind:value={eachItem}` (binding the each-block **identifier**). Binding
a **member** of it — `bind:value={item.width}` — is fine (objects are proxied). Don't pre-emptively
rewrite member binds; verify at runtime instead (open the component, drive the bind, assert no
`pageerror`).

## Driving 484 warnings → ~15
- Silence via **`compilerOptions.warningFilter` in `svelte.config.js`** — honoured by `svelte-check`
  AND the build; the old kit-level `onwarn` is **not** honoured by svelte-check. Filter all `a11y_*`,
  `element_invalid_self_closing_tag`, `attribute_quoted`.
- **Keep `state_referenced_locally` and `node_invalid_placement_ssr` visible** — the first flags
  real init-value captures worth a glance (most are benign: mapbox controls built once at mount,
  top-level prop destructures — same one-time behavior as Svelte 4, just newly vocal); the second
  flags real SSR/hydration nesting. Fix the structural ones: `<th>` must be inside `<tr>` inside
  `<thead>` (not directly in `<thead>`); avoid nested `<button>`/`<form>`. These are build WARNINGS
  in this stack (vite-plugin-svelte 7.1 / svelte 5.56), not fatal — but they cause real runtime
  `hydration_mismatch`, so fix for correctness.

## Verifying runes regressions
They surface as **runtime** console/pageerrors on a fresh full load (`state_unsafe_mutation`,
`each_item_invalid_assignment`, `invalid_default_snippet`), not at compile. Boot `node build`, load
every key route + open the editor + exercise the bind-heavy bits (e.g. table view →
ColumnAdjustSlideover), and **assert `page.on('pageerror')` + console `error`s are empty** (ignore
the stub's expected "Error loading cached index" — a no-network CDN fallback in the sandbox). Use
the shared `browser-launch.mjs` (puppeteer-core + system Chrome, no per-repo dep).

## eslint is NOT a gate here (yet)
`pnpm lint` (full) is blocked on Svelte 5 by **eslint-plugin-svelte@2.43.0**: its `svelte/indent`
rule **stack-overflows** on runes/snippet syntax, and it emits `ts/no-use-before-define`
false-positives (doesn't model runes hoisting / `$props`). Needs a plugin bump for Svelte 5 (its
own task). Meanwhile `eslint <dir> --fix --rule '{"svelte/indent":"off"}'` safely cleans the
codemod's cosmetic whitespace/quotes/semicolons.
