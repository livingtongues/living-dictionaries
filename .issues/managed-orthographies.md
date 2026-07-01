# User/agent-managed orthography registry

Let dictionary managers **and** agents manage a dictionary's orthographies (add / rename / reorder /
delete-if-unused), choosing keys from the IANA/Keyman writing-system lists or a custom slug, with
Keyman keyboards wired in automatically. Today orthographies are hand-set by LD staff via direct DB
edits, keyed positionally (`lo1`/`lo2`), which makes reordering unsafe.

## Decisions (interview with Jacob, 2026-07-01)

- **Immutable `code` per orthography.** The lexeme/sentence-text MultiString is keyed by `code`, not
  by array position. Reorder = reorder the array; render reads `lexeme[code]`. `code` never changes.
- **Migration owned by the Supabase→SQLite cutover (Q1=B).** No in-place backfill migration; the
  cutover mapper rewrites lexeme/sentence-text `lo{n}` keys → the new `code`. All pre-cutover VPS data
  is disposable (already swept — see below).
- **`code = bcp`** for legacy alternates (legacy `Orthography = { bcp, name: MultiString }` always has
  a bcp). Collapse the MultiString `name` → string (`default` else first value). Keep `bcp` populated
  so Keyman auto-loads. De-dupe if two share a bcp. When there's no bcp, mint a custom slug.
- **Primary headword stays `lexeme.default`** — the reserved, always-present, canonical key (68 app
  accessors rely on `entry.main.lexeme.default`). The primary is registry **slot 0**, `code:'default'`,
  `primary:true`, **pinned first, non-deletable**. Users may relabel it (`name`) + give it a `bcp`
  (keyboard) — the stored key stays `default`, so no entry rewrite. **Invariant: every dict always has
  a `default`-coded primary** (synthesized when not explicitly configured) → the accessor never breaks.
- **No "promote alternate to canonical" in the site.** Future: do it as a one-time DATA op that swaps
  the `default` key's contents with an alternate's across all entries (keeps site code simple). Not now.
- **Key source (Q2).** Picker shows the friendly `glossing-languages-list.json` (302 IANA subtags,
  i18n'd, eager) first; the full Keyman set (2,204 tags) is **lazy-loaded** on deeper search. Custom
  codes allowed, rejected only if they collide with a known tag (glossing-languages + additionalKeyboards
  + Keyman set) or a reserved token (`default`, `lo1..loN`) or an existing code in the dict.
- **Keyman minimal dataset.** Re-runnable script fetches the live Keyman cloud catalog → minimal
  `keyman-writing-systems.json` (tag → { keyboard_id, keyboard_name, language_name, font? }). DELETE
  the unused 39k-line `keyboards.json` (imported nowhere).
- **UI = collapsible region on Settings** (`EditableOrthographies.svelte`, manager-gated), beside gloss
  languages. Add-from-picker / custom, rename, reorder (up/down), delete-if-unused with inline
  "N entries use this" guard. Persists via `updateDictionary({ orthographies })` (catalog API).
- **Agent API parity (Q5).** Full CRUD under `/api/v1/dictionaries/{id}/orthographies` mirroring the
  sources sub-resource. Editor-gated, same shared.db catalog write path as the human UI.
- **Extend orthographies to sentences (Q6).** `sentences.text` MultiString gets the same alternate
  orthographies (today hardcoded `['default']`). Delete-guard + facet scan both entries.lexeme AND
  sentences.text.
- **Search facet (Q2b).** New `_orthographies: 'string[]'` in the Orama schema = set of non-empty codes
  per entry. Facet to include/exclude by orthography; auto-hidden when a code's count is 0 or == total.

## Data model

`dictionaries.orthographies: Orthography[]` (shared.db JSON column — no DDL change):
```ts
interface Orthography {
  code: string       // immutable storage key: 'default' (primary) | bcp | custom slug
  name: string       // editable display label ('' → generic label)
  bcp?: string       // optional; drives the Keyman keyboard
  notes?: string
  primary?: boolean  // slot 0 only; code is always 'default'; pinned + non-deletable
}
```
Rendering derives `[primary, ...alternates]`: `primary` = element with `code==='default'` (or a
synthesized `{ code:'default', name:'', primary:true }`); `alternates` = the rest, in array order.
Brand-new dicts keep `orthographies` null/[] (primary synthesized); labeling the primary writes the
explicit `code:'default'` element.

## Work items — ALL DONE (2026-07-01)

- ✅ **Type**: `code` + `primary` on `Orthography` + `PRIMARY_ORTHOGRAPHY_CODE` (`shared.types.ts`);
  `get_orthographies()` helper (`$lib/helpers/orthographies.ts`, tested) → `{ primary, alternates, all }`.
- ✅ **Keyman scrape**: `site/tools/keyman/generate-writing-systems.mjs` (default = vendored complete
  catalog `tools/keyman/keyman-catalog.json`, `--fetch` = live) → `keyman-writing-systems.json`
  (2,204 tags, 140KB, one-per-line). Moved the 39k-line catalog out of `src/lib` into `tools/`.
  `writing-systems.ts`: lazy `load_keyman_writing_systems()` + `keyboard_for_bcp()` +
  `is_reserved_or_known_code()` (all tested).
- ✅ **Cutover mapper**: `map_orthographies()` + `rewrite_orthography_keys()` in `mappers.ts`
  (`code = bcp`, name collapse, de-dupe, slug/`orth{n}` fallback); `migrate.ts` rewrites
  `lexeme`/`sentence.text` `lo{n}` keys per dict. Tested (4 unit tests).
- ✅ **Rendering off `code`**: EntryDisplay (alternate loop + primary/alternate `bcp` to Keyman),
  Cell + setUpColumns (`orthography_code`/`bcp` on the column), export
  (`format_orthographies`/`get_orthography_headers` by code), ListEntry sompeng (`key==='srb-sora'`),
  EntrySentence (`orthographies.all`, merged `text`). Print uses key-agnostic `get_local_orthographies`.
- ✅ **Keyman wiring**: `EditField` passes `bcp`; `Keyman.svelte` resolves via merged lookup +
  `showKeyboardButton` (curated flag preserved, keyman-set tags show when a keyboard exists).
- ✅ **Settings UI**: `EditableOrthographies.svelte` (+ `.stories.ts`, screenshot-verified) in a
  collapsible region on the settings page; usage guard scans `page.data.dict_db`; persists via
  `updateDictionary({ orthographies })`.
- ✅ **API (parity)**: v1 `GET/POST/PUT` + `PATCH/DELETE {code}` under `.../orthographies`, session-OR-key
  auth, server validation + in-use guard, shared `$lib/db/server/orthographies.ts` (also validates the
  catalog write). OpenAPI paths + `OrthographyInput` schema. 10 server tests.
- ✅ **Facet**: `_orthographies` in `entries-schema.ts` + `augment-entry-for-search.ts`; facet + `where`
  in `search-entries.ts`; `EntryFilters` FilterList with code→name labels + moot-hiding (drop count===total).
- ✅ **AGENTS.md**: added "Human/agent editing parity" section.
- ✅ **Verify**: full site vitest **947 pass** (updated 2 inline snapshots + search-index snapshot);
  `pnpm check` **0 errors**; eslint **0 errors** on all touched files; svelte-look screenshots good.

## Follow-ups / flagged
- **Keyman source is the vendored complete catalog (2,204 tags), not the live API** — the live
  `cloud/4.0/keyboards` returns only ~533 curated tags, and LD wants the long tail. Kept the full
  catalog as a `tools/` build input rather than deleting it (re-fetch a fuller export to refresh).
  Confirm this is acceptable vs. a pure live-fetch.
- **Legacy `scripts/import/*`** still emits `lo1/lo2` + old orthography shape — stale, already flagged
  for post-cutover porting; not touched here.
- **`scripts` e2e migrate tests** (2) fail locally on `better-sqlite3` native build (pre-existing env
  issue, unrelated); the 4 new orthography unit tests pass.
- **Future**: "promote alternate to canonical" = a one-time data op that swaps the `default` key's
  contents with an alternate across all entries (keeps site code simple). Not built.

## VPS prep — DONE (2026-07-01)
Swept all non-`river` dicts on the living VPS (6× e2e-log, headful, wfix — all 0-entry test artifacts):
removed `<id>.db` + `<id>.history.db` (+ wal/shm) and tombstoned their shared.db catalog rows (cascade
swept roles). Fresh `shared.db` backup taken first. Catalog + dictionaries dir are now river-only.

## Key files / patterns
- Orthography type: `site/src/lib/db/schemas/shared.types.ts`; column: `shared.ts` `dictionaries`.
- Legacy shape: `scripts/types/supabase/orthography.interface.ts` (`{ bcp, name: MultiString }`).
- Positional key today: `EntryDisplay.svelte` `lo${index+1}`; `Cell.svelte`/`setUpColumns.ts`
  `orthography_index`.
- Keyman: `site/src/lib/components/keyboards/keyman/` (`Keyman.svelte`, `keyboards.json` UNUSED);
  `glossing-languages.ts` (`glossingLanguages`, `additionalKeyboards`).
- Catalog write: `updateDictionary` → `api_dictionaries_catalog` → `api/dictionaries/[id]/catalog`.
- Sub-resource API template: `v1-sources.ts` + `routes/api/v1/dictionaries/[id]/sources/`.
- Facet schema: `site/src/lib/search/entries-schema.ts`.
- Settings model: `EditableGlossesField.svelte`.
