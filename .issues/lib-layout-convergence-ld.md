# LD lib/ layout convergence — mechanical slices

Executing the LIVING-DICTIONARIES mechanical slices from horse `.issues/lib-layout-convergence.md`.

## Do-not-touch (other session's untracked files)
`site/src/lib/components/home-v2/`, `site/src/lib/data/`, `site/src/routes/home-preview/`,
`site/scripts/build-map-data.mjs`, `site/static/map-data/`. Only fix a single import line if one of
these imports something I move.

## Key discovery — duplicate components (both live, different prop APIs)
`Modal`, `Slideover`, `ShowHide` each exist twice:
- **modern** root version (clean TS/Svelte-5, scoped theme CSS)
- **legacy** uno-compiled version (barrel points here)

APIs differ (`z_index`/`on_close`/`class` vs `zIndex`/`on:close`/`className`) → CANNOT merge without
behavior change (that's the out-of-scope M2c runes migration). Consumer counts:
- root `Modal.svelte` → 6 importers (modern) · `ui/Modal.svelte` → barrel (legacy)
- root `ShowHide.svelte` → 3 importers (modern) · `functions/ShowHide.svelte` → barrel (legacy)
- root `Slideover.svelte` → **0 importers (DEAD, delete)** · `ui/Slideover.svelte` → barrel (legacy)

### Dedup decision (documented for future M2c dedup)
- modern owns canonical name: `components/ui/Modal.svelte`, `components/ui/ShowHide.svelte`
- legacy kept temporarily as `components/ui/LegacyModal.svelte`, `components/ui/LegacyShowHide.svelte`
  (name signals "slated for M2c removal — converge onto the modern one")
- `components/ui/Slideover.svelte` = the legacy `ui/Slideover` (no modern competitor; root dead deleted)

## Slice checklist — ALL DONE ✅ (uncommitted)
- [x] 1. Kill svelte-pieces/index.ts barrel → direct current paths (85 barrel imports, all single-line)
- [x] 2. ui/ + root components → components/ui/
- [x] 3. functions/ → components/ui/
- [x] 4. data/ → components/ui/
- [x] 5. TS → utils/ (clickoutside .js/.d.ts→.ts, longpress, portal, trap-focus, should-autolink, detect-url, load-once)
- [x] 6. state → state/ (new folder): persisted-state, toast, persisted-store (.js/.d.ts→.ts),
      query-param-store → query-param-state.svelte.ts, dark-mode; clean-object → utils/clean-object.ts
- [x] 7. helpers/ generic → utils/ (cookies, debounce, deep-partial, prune+test, share, sleep, slugify,
      time, media-url, remove_italic_tags→remove-italic-tags)
- [x] 8. deleted svelte-pieces/

## Verification (repo root)
- `pnpm check`: 3 errors, ALL pre-existing in the other session's untracked files (home-preview,
  home-v2/FeaturesGrid) — my surface is 0 new errors (baseline was also these 3).
- `pnpm lint`: baseline already RED from the other session's minified JSON data files
  (static/map-data/*.json, home-v2/map/data/*.json = ~24.7k errors). `eslint --quiet` over my surface
  (components/ui, utils, state, all rewritten consumers) = 0 error-level problems.
- `pnpm test -- --run`: 1222 passed / 3 skipped.
- svelte-look: Button + StagedImageThumb render correctly (light + dark). Modal/LegacyModal have no
  story files (never did) so can't be screenshot standalone.

## Follow-ups for later (out of this mechanical scope)
- M2c dedup: converge `LegacyModal`/`LegacyShowHide` onto the modern `Modal`/`ShowHide` (different
  prop APIs — a real rewrite, not a relocation).
- Domain helpers still in `helpers/` (glosses+test, exampleSentences, entry/, orthographies,
  vernacularName, inviteHelper, tag-visibility, media.ts) + `stores/columns.ts` — judgment homes.
- CSS comments in uno-preflights.css/theme.css/reset.css still mention "svelte-pieces" historically
  (the `sp-*` shadows are still used by the Legacy* components) — left as-is.
- `.svx`/`.composition` svelte-look fixtures import the external `svelte-pieces` npm package (not
  `$lib`) — untouched, out of scope.

## Notes
- `svelte-pieces/stores/clean-object` was thought dead but is imported by query-param-store → moves
  to `utils/clean-object.ts` (typed) as a required dependency.
- Domain helpers (glosses, exampleSentences, entry/, orthographies, vernacularName, inviteHelper,
  tag-visibility, media.ts) and `stores/columns.ts` left in place — judgment for later.
</content>
