# "Alternate Orthographies" → "Orthographies" + facet fixes

## Scope (gallery-button task dropped per Jacob — not doing that one)

1. Drop the word "Alternate" from the orthographies UI (settings page + entries facets).
2. The entries-list orthography facet should also offer the **default/primary**
   orthography as a filter option, but only when it's **named** (settings has a
   label for it) AND **not 100%** of the current result set has it populated
   (e.g. /river dictionary, where some entries lack the default RPA orthography).
3. Bug: clicking an orthography checkbox to filter by it makes that facet's own
   section vanish (only "Clear filters" brings it back). Happens because the
   facet list hides any value whose count equals the current total ("moot"
   values) — once you filter BY that value, 100% of the remaining results have
   it, so it wrongly hides itself (and, since it was the only entry in the
   list, the whole `{#if Object.keys(orthography_values).length}` block).

## Plan

- `en.json` `entry_field.local_orthography`: "Alternate Orthographies" → "Orthographies".
  This one key drives the settings section header + `EditableOrthographies`
  title + entry table column + print field + facet label — single-source fix.
- `EditableOrthographies.svelte` hint text: drop "alternate" wording too.
- `augment-entry-for-search.ts`: stop excluding `default` from `_orthographies`
  (include any populated lexeme key). Update `entries-schema.ts` comment.
- `EntryFilters.svelte`:
  - `orthography_labels` includes the primary (`code: 'default'`) only when
    `registry.primary.name` is truthy.
  - `orthography_values` filter: keep a key only if it's `in orthography_labels`
    (this is what naturally excludes an unnamed default) AND (`count !== total`
    OR it's currently selected in `$search_params.orthographies`) — the second
    clause is the disappearing-facet bugfix, and it's specific to orthographies
    since no other `FilterList` does moot-value hiding.
- Update/regenerate the `_orthographies` inline-snapshot tests
  (`search-entries.test.ts`, `augment-entry-for-search.test.ts`) via `vitest -u`.
- Add an `EntryFilters.stories.ts` scenario covering: default orthography shown
  (named + <100%), and a selected orthography staying visible when its count
  equals total.
- Verify visually with svelte-look screenshots.

## Status

✅ Done.

- `en.json` `local_orthography` → "Orthographies" (drives settings header, `EditableOrthographies`
  title, entry table column, print field, and the facet label — single source).
- `EditableOrthographies.svelte` hint reworded to drop "alternate".
- `augment-entry-for-search.ts`: `_orthographies` now includes `default` when populated (was
  excluded). `entries-schema.ts` comment updated to match.
- `EntryFilters.svelte`: `orthography_labels` now includes the primary (keyed `default`) only when
  it has a configured name; `orthography_values` keeps a value if it's in `orthography_labels` AND
  (not moot OR currently selected) — fixes both the missing-default-facet request and the
  disappearing-checkbox bug (which was specific to orthographies, the only facet with moot-value
  hiding).
- Regenerated the `_orthographies` inline snapshots in `search-entries.test.ts` (`vitest -u`).
- Added two `EntryFilters.stories.ts` scenarios + screenshotted them:
  `OrthographyFacetIncludesNamedPartialDefault` (river-like: named default at 95% shows up next to
  an alternate) and `SelectedOrthographyStaysVisibleAtFullCount` (checked filter stays checked/visible
  even once its count reaches the new, filtered total).
- Full `pnpm vitest run` (148 files) + `svelte-check` clean.

Gallery-button visibility request was explicitly dropped by Jacob mid-conversation (blink concern,
not worth the complexity) — not implemented.
