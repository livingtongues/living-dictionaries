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

## Non-English locale files are DB-baked, not hand-maintained (Google Sheet RETIRED)
`site/src/lib/i18n/locales/**/<locale>.json` (main + `{ps,psAbbrev,gl,sd}/`) are NOT hand-edited
like `locales/en.json` (English is code-owned — edit those). Every non-English value lives in
`shared.db` (`i18n_keys` mirrors the EN catalog at boot; `i18n_translations` holds values) and is
edited by translators at `/translate`. The committed JSON files are only a **seed + fallback**;
`pnpm i18n:refresh` (`scripts/fetch-baked-i18n.mjs`, default URL = prod `/api/i18n/export`, reads
the live DB) overwrites them at deploy bake-time. The old `scripts/locales/` + Google Sheet flow is
**gone** — never resurrect it. Adding a POS now takes: the mapping in `parts-of-speech.ts` + the
`ps`/`psAbbrev` **en.json** keys; `sync_en_catalog` propagates the new EN key into the DB on the next
boot, and translators/`/fill-translations` fill the rest.

### GOTCHA — the committed seed files carry empty-string placeholders
Every untranslated `(key, locale)` still exists in the committed JSON as `""` (sheet-era artifact).
So after a `/fill-translations` AI pass + `pnpm i18n:refresh`, the git diff is a **symmetric
ins/del** (each `""` → value = 1 del + 1 ins), NOT net additions — a "0 removed / N changed
(empty→value) / 0 real-overwrite" result is the correct, sane signal. Verify the refresh by
flattening HEAD vs working and confirming every change had an empty old value (no non-empty
overwrite, no key removed). The DB insert path is `ON CONFLICT (key_id,locale) DO NOTHING` so a
concurrent human write is never clobbered.

## Facet-label refresh behavior
The entries-page facets are built from the local wa-sqlite DB at load; deltas pulled by the leader
worker during a session don't relabel the already-rendered facet list — the fix shows on the next
load. (Observed while verifying the river repair; existing architecture, not a bug introduced here.)
