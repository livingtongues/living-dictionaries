# Parts of speech + sectioned i18n locale files

## Canonical POS form
Senses store the **lowercase `enAbbrev`** from `$lib/mappings/parts-of-speech.ts` (e.g. `n`,
`conj`); display translates via a **case-sensitive** `ps.<key>` dynamic i18n lookup. The `/api/v1`
write path normalizes case-insensitively (abbrev or full English name → canonical abbrev; unknown
values pass through verbatim — Mayan dicts store full Spanish phrases as POS). Added 2026-07-02
after the river import stored `["N","CONJ",…]` and the entries-filter facet showed raw keys.

River's 2,549 affected prod senses were repaired in place (lowercased + `updated_at` bumped so the
trigger advanced `last_modified_at` and clients pulled the fix via `/changes` — no history events;
backup left at `/data/dictionaries/river.db.bak-2026-07-02T02-56-52-813Z`).

## Sectioned locale files regenerate from a Google Sheet — hand-edits get wiped
`site/src/lib/i18n/locales/{ps,psAbbrev,gl,sd}/<locale>.json` are NOT hand-maintained like the main
`locales/en.json`. They're regenerated wholesale by `pnpm --filter scripts update-locales` from the
i18n Google Sheet (`I18N_GOOGLE_SHEET_ID` in `scripts/locales/update-locales.ts`; tab
`Parts-of-Speech` has columns `en,key,enAbbrev,esAbbrev,es`). Adding a POS therefore takes THREE
places: the mapping in `parts-of-speech.ts`, the `ps`/`psAbbrev` en.json files (for immediate use),
AND a row in the sheet (or the next regen deletes the key). As of 2026-07-02 the `obj` (object
marker) row still needs to be added to the sheet.

## Facet-label refresh behavior
The entries-page facets are built from the local wa-sqlite DB at load; deltas pulled by the leader
worker during a session don't relabel the already-rendered facet list — the fix shows on the next
load. (Observed while verifying the river repair; existing architecture, not a bug introduced here.)
