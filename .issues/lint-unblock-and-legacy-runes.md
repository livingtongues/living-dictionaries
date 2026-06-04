# Lint unblock + finish runes migration of legacy stragglers

Part of vps-migration (between M2c and M3). Two commits on `vps-migration`.

## Task 1 — search-worker sense duplication ✅ DONE (commit 4499a358)
Reset module-level grouping maps in `entry.worker.ts` before each bulk load. Repro + fix verified
(headless multi-load: e_ak shows exactly 1 sense; achi-flow 5/5 intact).

## Task 2 — `pnpm lint` to 0 errors, hook re-enabled
### Approach (decided): go fully custom like the example/house (NOT antfu)
- Ported `eslint.config.js` from `living-dictionaries-example` (same app, fully migrated), adjusted
  ignores for vps-migration tree (`packages/**`, `supabase/**`, `site/e2e/**`, vendored lz-string,
  `.vercel`/`build`/coverage). Deleted stale `site/.vercel` (32M; node adapter only now).
- Swapped root devDeps antfu→custom stack (eslint 10, @stylistic, import-x, n, perfectionist, regexp,
  unicorn, eslint-plugin-svelte@3.17, svelte-eslint-parser@1, jacob-8 stylistic fork, typescript-eslint,
  jsonc, @vitest/eslint-plugin). Lockfile drift = eslint-only (verified; no runtime deps moved).
- `lint`/`lint:fix` = `eslint --cache [--fix] --quiet`. Added `prepare` (core.hooksPath .githooks).

### After autofix: 176 errors remain. Decision per Jacob: FIX the legacy files into Svelte 5 runes
(don't just disable rules). Use house/tutor/example svelte-pieces as references; keep UnoCSS styles.

Remaining-error categories:
- `import-x/no-mutable-exports` (54) — `export let` in legacy `.svelte` (pieces + @migration-task comps)
- `svelte/require-each-key` (58) — add keys (house conventions: `.id`, else index)
- `@stylistic/no-tabs` (39) — mostly `site/static/manifest.json` (convert tabs→spaces) + a few
- stale disable directives: `@typescript-eslint/ban-types`, `ts/*` (removed in TS-ESLint v8) → rename/remove
- small: no-useless-assignment(4), require-await(3), no-empty-function(3), prefer-svelte-reactivity(3),
  one-var(2), no-unsafe-function-type(2), regexp/no-unused-capturing-group(1), prefer-spread(1),
  no-empty-object-type(1), preserve-caught-error(1)

### Runes conversion plan (legacy stragglers)
KEY FINDING: consumers were already snippet-converted by M2c codemod; pieces still use `<slot>`.
Mostly convert PIECES; only component-EVENT consumers (`on:foo`) need edits.

svelte-pieces (keep UnoCSS `<style>` blocks verbatim):
- [ ] ui/Badge.svelte — export let→$props, $$props.class→class prop, <slot>→children, on:click→onclick
- [ ] functions/DetectUrl.svelte — render-prop → `{@render children?.({ display, href })}`
- [ ] functions/ReactiveSet.svelte — $props, $:→$derived/$effect, drop unused dispatch, SvelteSet
- [ ] functions/Menu.svelte — $props, $$props.class, <slot>→children
- [ ] functions/IntersectionObserverShared.svelte — copy tutor's runes version (callbacks)
- [ ] ui/ResponsiveSlideover.svelte — $props, $$slots→children checks, slots→snippets
- [ ] data/BadgeArray.svelte — $props, $:→$derived, dispatch→on_valueupdated callback
- [ ] data/BadgeArrayEmit.svelte — $props, dispatch→callbacks (on_itemclicked/itemremoved/additem)
- [ ] data/Form.svelte — copy house's runes version (no consumer uses let:loading → safe)
- leave functions/ShowHide.svelte LEGACY (no export let → lint-clean; 35 consumers; defer)

event consumers to update:
- [ ] BadgeArray on:valueupdated → on_valueupdated: EntrySource, EditableAlternateNames
- [ ] BadgeArrayEmit on:itemclicked/itemremoved/additem → callbacks: EditableGlossesField,
      DictionaryRow, RolesManagment, DictionariesHelping

@migration-task app components (finish M2c):
- [ ] components/image/ImageDropZone.svelte
- [ ] components/record/Recorder.svelte
- [ ] [dictionaryId]/entries/components/Audio.svelte
- [ ] [dictionaryId]/entries/components/Video.svelte
- [ ] [dictionaryId]/entry/[entryId]/EntryHistory.svelte
- [ ] [dictionaryId]/entry/[entryId]/EntryField.svelte
- [ ] api/email/components/DarkModeSupport.svelte

other:
- [ ] maps/mapbox/map/Marker.svelte — module Set: eslint-disable prefer-svelte-reactivity (registry)
- [ ] site/static/manifest.json — tabs→spaces
- [ ] require-each-key — add keys across ~38 files
- [ ] stale disable directives — debounce.ts, og/component-to-png.ts, app.d.ts

### Hook
`.githooks/pre-commit` (mirror house/example: test → check → lint:fix → re-stage staged files).

## Verify gate (both tasks)
check 0 err · test 123 · build + node build boot · achi-flow 5/5 · headless pageerror-empty · lint 0 err.
Two commits (Task1, Task2). No push. Append result to cross-project-orchestration ledger.

## RESULT ✅ (2026-06-04)
Both tasks complete on `vps-migration`.
- **Task 1** (commit `4499a358`): worker grouping-map reset. Repro proven (Sense 2/3 with fix off → gone with fix on).
- **Task 2**: fully-custom eslint (ported from example, eslint 10 / svelte-plugin 3 / @stylistic / canonical names),
  deleted stale `site/.vercel`, finished runes migration of all legacy stragglers (9 svelte-pieces incl. event→callback
  + slot→snippet, 7 @migration-task components, longpress.js→.ts typed Action, Marker module-Set disable), added 53
  `{#each}` keys, fixed all stale `ts/*`/`ban-types` disables + small rule violations, manifest tabs→spaces, re-enabled
  the `.githooks/pre-commit` (test→check→lint:fix→re-stage) + `prepare` hooksPath.
- **Verify gate (all green):** check 0 err / 15 warn · test 123 · build + `node build` boot · achi-flow 5/5 ·
  sense-dup repro 1 sense · headless 9-route scan 0 real errors · `pnpm lint` 0 errors. lint:fix churn = 125 files
  (stylistic auto-fixes — import sorting/quotes/commas — behavior-neutral; mirrors house's config adoption).
