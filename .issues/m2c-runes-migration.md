# M2c — migrate component syntax to Svelte 5 runes ✅ DONE

Converted LD's Svelte-4 legacy components to Svelte-5 runes. App stays runnable + visually
identical; nothing functional changed. Mirrored house's already-finished runes migration.

Baseline at start (M2b checkpoint `6aa75c16`): check 0 errors / **484 warnings**.
**Final: check 0 errors / 15 warnings · test 123 pass · build + node build boot · achi-flow 5/5 ·
19 routes + editor + table/ColumnAdjust headless load = 0 real console/pageerrors.**

## Approach (house's solved pattern)
- Interactive `sv migrate svelte-5` hangs at 99% CPU in non-TTY (clack busy-loops on piped stdin).
  Workaround: call the migration transform functions directly, **one child process per file, 30s
  timeout**. Driver in `/tmp/runes-migrate/` (svelte-migrate@1.10.2 installed there to avoid lockfile
  drift; `migrate` imported from the repo's own svelte 5.56 compiler at
  `site/node_modules/svelte/src/compiler/index.js`).
  - `migrate-one.mjs` — per file: `transform_app_state_code` (svelte file) → `transform_module_code`
    + `transform_svelte_code(code, migrate, …)`; `.ts/.js` → `update_js_file(transform_module_code)`.
  - `run-all.mjs` — walks `src`, **excludes `src/lib/svelte-pieces/`** (vendored, already Svelte 5).
- Result: **367 files migrated, 0 hung, 0 errored.** Codemod alone: 484 warn → 121 warn, +42 errors.

## Hand-fixes applied (codemod fallout: 42 → 0 errors)
- ✅ `@migration-task` bailout: **MediaStream.svelte** — slot `error` collided with local `error`
  var. Hand-migrated to runes; renamed the snippet prop `error` → `error_snippet`; `<script
  context="module">` → `<script module>`; `$:`→`$derived`/`$effect`. (Other 7 `@migration-task`
  files compiled fine — comment is advisory; only MediaStream actually errored.)
- ✅ `ComponentProps<X>` → `ComponentProps<typeof X>` — 7 email components (cleared the email
  `never`/spread cascade, ~20 errors).
- ✅ `$app/stores` → `$app/state` **template gap**: swept `$page.` → `page.` in SelectVideo markup
  (codemod converted import+script, missed markup). (It was the only straggler.)
- ✅ **email SSR was runtime-broken** (Svelte-4 removed `component.render()`): ported the example
  repo's `svelte/server` `render` version of `render-component-to-html.ts`.
- ✅ legacy HTML attrs: `<td bgcolor>` → `{...{ bgcolor }}` + `background-color` style (Row);
  dropped redundant `<img border="0">` (TrackingPixel — style already sets it).
- ✅ `onclickoutside` typing: added `onclickoutside?` to vendored `clickoutside.d.ts` Attributes
  (runes needs the `onX` form; `on:clickoutside` is legacy).
- ✅ drag-event typing: `ondrop={preventDefault((e: DragEvent) => …)}` (SelectAudio, SelectVideo).
- ✅ `unknown`/`{}` from untyped each/state: VirtualList `let viewport/contents: HTMLElement`;
  RegionModal `{@const points = value as LngLatFull[]}` (ReactiveSet's legacy slot is untyped).
- ✅ **Slideover → runes** (was the `each_item`-adjacent `title`-snippet type error): converted the
  vendored legacy slot component to snippet props (`title/heading/children` with `= undefined`
  defaults so they're optional; kept `createEventDispatcher` for `on:close` forwarding). All its
  consumers are now runes so this was safe. ResponsiveSlideover (legacy JS) still passes
  `<svelte:fragment slot="heading">` — interop works.

## Build-fatal-class HTML nesting (fixed for correctness/hydration; not fatal in this build)
- ✅ `<th>` direct child of `<thead>` → wrapped in `<tr>`: SortUsers, SortDictionaries, sortRecords.
- Badge.svelte nested `<button>` (onclick branch): **left as-is** — pre-existing legacy, vendored,
  browser-tolerant, rendered fine for years; restructuring risks the visual. 1 remaining
  `node_invalid_placement_ssr` warning, documented.

## Warnings 484 → 15 (`compilerOptions.warningFilter` in svelte.config.js)
- Silenced (honoured by svelte-check, unlike the old `onwarn`): all `a11y_*`,
  `element_invalid_self_closing_tag`, `attribute_quoted`. Fixed `script_context_deprecated`
  (MediaStream) and both `event_directive_deprecated` (Slideover `on:`→`onX`).
- **Kept visible (intentional):** 14 `state_referenced_locally` (init-value captures — mapbox
  controls created once at mount, top-level prop destructures; same one-time behavior as Svelte 4,
  just more vocal in 5) + 1 `node_invalid_placement_ssr` (Badge nested button, above).

## Shared headless launcher (task step 3) ✅
- `site/e2e/achi-flow.mjs` now `import { launch } from '/home/jacob/.claude/skills/browser-tools/
  browser-launch.mjs'` (brings its own puppeteer-core + system Chrome). Dropped local
  `puppeteer-core` + `chrome-launcher` from `site/package.json` (nothing else used them;
  `--frozen-lockfile` clean). Flow still PASS 5/5.

## each_item_invalid_assignment — checked, none
- Only suspect was ColumnAdjustSlideover `bind:value={column.width}` in a keyed each. **Member**
  expressions are allowed in runes (the error is only for binding the bare each-item identifier).
  Verified at runtime: switched to table view → clicked a column header → ColumnAdjustSlideover
  opened (21 width sliders) → dragged one → **no pageerror**.

## Lint (NOT a gate — flagged for follow-up)
- `pnpm lint` (full) is blocked by **eslint-plugin-svelte@2.43.0 `svelte/indent` stack-overflow on
  Svelte 5 runes/snippet syntax**, and the same old plugin emits `ts/no-use-before-define`
  false-positives (doesn't model runes hoisting). Both need an **eslint-plugin-svelte bump for
  Svelte 5** (separate task; house kept lint OFF for analogous legacy reasons).
- Ran `eslint site/src --fix --rule '{"svelte/indent":"off"}'` → cleaned the codemod's cosmetic
  whitespace/quotes/semicolons across 21 files. Re-verified check/test/build/flow all still green.
  The e2e `.mjs` lints clean. Residual errors are pre-existing legacy + the runes-hoisting
  false-positives.

## Tooling left in /tmp/runes-migrate (throwaway, not committed)
`migrate-one.mjs`, `run-all.mjs`, `route-check.mjs`, `col-adjust-check.mjs`, svelte-migrate dep.
