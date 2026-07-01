# Structured sources: registry table + slug refs on entries + search facet

## Status
**IMPLEMENTED (2026-07-01).** All plan sections below done. `pnpm test` (830 site tests) green,
`tsc` clean, `svelte-check` 0 errors, `eslint --quiet` clean. EditSource + EntrySource visually
verified via svelte-look.

### What shipped (files)
- Schema: `dictionary.ts` (`sources` table + `sentences.sources`/`texts.sources` cols); migration
  `dictionary-migrations/20260701_sources.sql` (table + ALTERs + lmod triggers + re-declared
  `process_delete_cascade`); `dict-syncable-tables.ts`, `types/db.ts`, `dictionary-json-columns.ts`.
- Search: `entries-schema.ts` (`_sources`), `augment-entry-for-search.ts` (emit `_sources`, drop
  sources from `_other`), `search-entries.ts` (facet + where), `search/types.ts`, `EntryFilters.svelte`
  (+ story). Worker/store: `entry.worker.ts`, `entries-ui-store.ts`, `search/index.ts`,
  `read-dict-bundle.ts`, `[dictionaryId]/+layout.ts` (→ `page.data.sources`).
- Server (strict): `source-slugs.ts` (shared validator, no import cycle), `v1-sources.ts` (CRUD +
  `count_source_references` + `remove_source_from_all` + delete-refused-while-referenced),
  `v1-entry-write.ts` (entry+sentence slug validation), `entry-input.ts`. Routes:
  `api/v1/…/sources/+server.ts` (GET/POST), `…/sources/[sourceId]/+server.ts` (PATCH/DELETE w/
  `?remove_from_all`). OpenAPI: `openapi.ts` + `openapi.test.ts`.
- Client + UI: `slugify.ts`, `operations.ts` (`insert_source`/`update_source`/
  `remove_source_and_delete`) + `dbOperations.ts` + `mocks/db.ts`, `EditSource.svelte` (+ story),
  `EntrySource.svelte` rewrite (+ story), `[dictionaryId]/sources/+page.svelte` management page,
  `SideMenu.svelte` nav item, `i18n/locales/en.json` (`source.*`).
- Cutover: `scripts/supabase-cutover/mappers.ts` (`build_dict_sources`) + `migrate.ts` wiring +
  `migrate.test.ts` unit tests.

### ⚠️ Pre-existing breakage discovered (NOT from this work)
The upstream commit `848b639d` (agent API keys) left `scripts/supabase-cutover/migrate.test.ts`'s
TWO end-to-end tests failing (verified by stashing my work): (1) shared-migration count assertion
`expected 2 to be 1` — it added `20260629_api_keys.sql` without updating the count; (2) `table
entries has no column named deleted` on bulk insert. Both are in delete-after-cutover tooling and
unrelated to sources. Flagged to Jacob — not fixed here.

---
**Design (finalized with Jacob 2026-07-01) — all decisions resolved below.**

## Why
Entries currently carry `sources` as **free text** (`EntryInput.sources` / `EntryPatch.sources` =
`string | string[]`; the `entries.sources` JSON `string[]` column stores whatever the writer typed).
We're importing several printed dictionaries via the
public Write API, and we want:

- **Deterministic** source attribution (a stable reference, not a per-run typed string).
- Multiple sources per entry (already an array — keep it).
- **Filter by source in entry search** (a facet, not full-text).

The import pipeline already has a slug→citation registry on its side. This issue is the **LD app
half**: give sources a real home so the importer sends a **slug** and the app can display + facet on it.

## Resolved decisions (do NOT relitigate)
1. **Registry table is per-dictionary** — lives in `dictionaries/{id}.db`, like `tags`/`dialects`.
   (Not global/shared.db — keeps the per-dict snapshot/sync model uniform.)
2. **Sources apply to entries, sentences, AND texts** — each gets a `sources` array column of slugs
   (JSON `string[]`), NOT a junction. No FK; integrity mitigated by write-time validation (API) +
   client-side found-or-create (UI) + the strict-deletion policy (#12). Sentences/texts have no
   sources UI yet — this just sets the data model so the data can be populated (via import / future
   UI). In Supabase only entries had `sources`, so sentences/texts start empty (no cutover data).
3. **v1 Write API is STRICT** — an unknown source slug is rejected with `400` ("unknown source slug
   'x'; create it via POST …/sources first"). Rationale: a source needs rich metadata, so a bare
   auto-created slug row is useless (unlike a tag, which *is* its name). Agents/importers must create
   sources first. Humans never hit this — the editor UI creates the source client-side before linking.
4. **Sources are FACET-ONLY, not full-text.** `entry.sources` holds bare slugs; the citation text is
   **removed from the Orama `_other` full-text field**. Slugs go into a new `_sources` filter field.
   Jacob: "tapping facets is easier than searching and lessens false positives." Labels are resolved
   at display time from `page.data.sources`, never denormalized onto the entry doc.
5. **`type` is a fixed enum in `constants.ts`**: `dictionary` / `wordlist` / `fieldwork` /
   `manuscript` / `other`.
6. **Create/edit UX = one shared `EditSource` modal** reused by (a) the entry editor's "＋ create new
   source" button and (b) the `/[dictionaryId]/sources` management page. The entry-editor picker
   attaches EXISTING sources via autocomplete (no free write-in — write-in can't carry metadata).
7. **slug** is auto-generated from the abbreviation (fallback citation), editable, uniqueness-checked
   per dict.
8. **Migration**: handled generically by the **Supabase cutover** script — per dict, dedupe distinct
   source strings → one `sources` row each, `slug = slugify(string)` (suffixed on collision),
   `citation = original string`, other metadata null. No parsing of author/year from free text.
9. **Display precedence** in badges + facet chips: `abbreviation || citation || slug`, full citation
   on hover/tooltip.
10. **v1 entry READ** returns `sources` as bare slugs; `GET …/sources` provides the registry for
    resolution.
11. **NOT touched:** the separate `audio.source` / `videos.source` / `photos.source` free-text
    media-attribution columns are unrelated.
12. **A source can NOT be deleted while referenced.** `apply_source_delete` refuses (409-style) if the
    slug appears in ANY entry/sentence/text `sources` array. The management UI surfaces "used by N
    entries · M sentences · K texts" and offers a **danger confirm** "Remove from all N references &
    delete" — which strips the slug from every referencing row (patching their `sources` arrays) and
    THEN deletes the source. No dangling slugs are ever left behind.

## Sources registry table (schema)
`dictionaries/{id}.db`, all plain-text/int columns (NO JSON columns → `DICT_JSON_COLUMNS.sources = []`):

| column | notes |
|---|---|
| `id` | uuid PK |
| `slug` | stable id, **UNIQUE per dict** (unique index) |
| `citation` | full display citation |
| `abbreviation` | short label for badges/facet |
| `author` | nullable |
| `year` | nullable (INTEGER or TEXT — TEXT to allow "1979–1985"; **use TEXT**) |
| `url` | nullable |
| `license` | nullable |
| `type` | enum (constants.ts): dictionary/wordlist/fieldwork/manuscript/other |
| `dirty` `created_by_user_id` `created_at` `updated_by_user_id` `updated_at` | standard sync/audit |

## Implementation plan (blast radius)

### 1. Schema + migration
- [ ] `src/lib/db/schemas/dictionary.ts` — add `export const sources = sqliteTable('sources', {…})`
  (registry). Add a `sources: text({ mode: 'json' }).$type<string[]>()` column to **`sentences`** and
  **`texts`** (entries already have it).
- [ ] New migration `src/lib/db/schemas/dictionary-migrations/2026XXXX_sources.sql`:
  - `CREATE TABLE IF NOT EXISTS sources (…)` + `CREATE UNIQUE INDEX … ON sources(slug)` +
    `CREATE INDEX … ON sources(updated_at)`.
  - `ALTER TABLE sentences ADD COLUMN sources TEXT;` + `ALTER TABLE texts ADD COLUMN sources TEXT;`
    (JSON string[] stored as TEXT; SQLite ADD COLUMN is fine for a nullable column).
  - Additive `sources_after_insert_bump_lmod` / `sources_after_update_bump_lmod` triggers.
  - **`DROP TRIGGER process_delete_cascade; CREATE TRIGGER …`** re-declaring the full cascade WITH a
    `DELETE FROM sources WHERE id = NEW.id AND NEW.table_name = 'sources';` line added (SQLite has no
    ALTER TRIGGER; the trigger is one hardcoded per-table list).
  - GOTCHA (per AGENTS): server snapshots need a rollback-journal header for the OPFS VFS — no action
    here, just don't break `journal_mode = DELETE` server-side.
- [ ] `dict-syncable-tables.ts` — add `'sources'` to `DICT_SYNCABLE_TABLES` (FK-safe: it's a
  parent/standalone like `tags`; place near tags/dialects).
- [ ] `dictionary-json-columns.ts` test — assert `DICT_JSON_COLUMNS.sources` = `[]`; `entries`,
  `sentences`, and `texts` all include `sources` in their JSON-column lists (the slug array column).

### 2. Search (facet-only)
- [ ] `search/entries-schema.ts` — add `_sources: 'string[]'` under Filters.
- [ ] `search/augment-entry-for-search.ts` — emit `_sources: entry.main.sources || []`; **REMOVE**
  `entry.main.sources` from the `_other` array (it's now facet-only).
- [ ] `search/search-entries.ts` — add `_sources: { limit: 10 }` to `facets`; add
  `...query_params.sources ? { _sources: query_params.sources } : {}` to `where`.
- [ ] `search/types.ts` (QueryParams) + the query-param store — add `sources`.
- [ ] `routes/[dictionaryId]/entries/EntryFilters.svelte` — add a `<FilterList search_param_key="sources">`
  with `keys_to_values` mapping slug → `abbreviation||citation||slug` from `page.data.sources`.
- [ ] The worker (`entry.worker.ts`) does NOT need a sources grouping map (slugs are already on the
  entry column). It DOES need to surface the registry to the UI:
  - Load `bundle.sources` in `init_entries`; call a new `set_sources(Object.values(sources))`.
  - Add a `'sources'` case in `apply_one` / `SYNC_TABLE_ORDER`: upsert the `sources` dict + call
    `set_sources`; return `[]` (no entry re-index — facet keys are slugs, display resolves live).
  - Editing a source's abbreviation → only refreshes `page.data.sources`; entries need no re-index.
  - Read the sources rows in the bundle assembly (`read-dict-bundle.ts` / wherever the bundle is
    gathered) + SSR `build-entry-data.ts` context if needed for first-paint display.
- [ ] `entries-ui-store.ts` — add a `sources` field (mirror `tags`).
- [ ] `routes/[dictionaryId]/+layout.ts` — surface `sources: entries_ui.sources` into `page.data`.

### 3. Server write path (v1) — STRICT validation
- [ ] `lib/db/server/v1-entry-write.ts`:
  - Load a `source_slug_set` (like `load_tag_map`) once per call; add a shared
    `validate_source_slugs(slugs, set)` helper that throws on unknown.
  - In `build_entry` + `build_entry_patch_row`: for each slug in `entry.sources`, throw
    `Error("unknown source slug 'x'; create it via POST …/sources first")` if not in the set. The
    per-item SAVEPOINT reports it in `failed` (bulk) / route 400s (single).
  - Also validate slugs on the **sentence** write path (`build_sentence_rows` /
    `apply_sentence_update`) once `SentenceInput.sources` exists. Store validated slugs verbatim.
- [ ] `lib/api/v1/entry-input.ts` — update the `sources` doc comment (slugs, strict, must pre-exist).
  Add optional `sources?: string[] | string` to `SentenceInput` + `SentencePatch` (data model set;
  texts have no v1 write path yet, so the text `sources` column is populated only by import/future UI).
- [ ] `lib/db/server/v1-sub-resources.ts` — add:
  - `interface SourceRecord` (all columns), `list_sources(db)`,
  - `create_source({ db, history_db, user_id, input })` — validates required slug+citation, unique
    slug (throws on collision), inserts via `merge_dict_row`,
  - `apply_source_update(...)` (patch metadata; reject slug collision on rename),
  - `count_source_references(db, slug)` → `{ entries, sentences, texts }` via
    `EXISTS (SELECT 1 FROM json_each(<table>.sources) WHERE value = ?)` per table,
  - `remove_source_from_all(db, slug, …)` — strip the slug from every referencing entry/sentence/text
    `sources` array (patch each via `merge_dict_row`),
  - `apply_source_delete(...)` — **refuse if `count_source_references` > 0** (throw a conflict the
    route maps to 409); the caller uses `remove_source_from_all` first for the "remove & delete" path.
    Deletes via `run_tombstone_delete`.

### 4. API routes (mirror tags)
- [ ] `routes/api/v1/dictionaries/[id]/sources/+server.ts` — `GET` (list, role contributor) + `POST`
  (create, role editor).
- [ ] `routes/api/v1/dictionaries/[id]/sources/[sourceId]/+server.ts` — `PATCH` + `DELETE` (editor).
  `DELETE` 409s with the reference counts if still in use, unless `?remove_from_all=true` (or a body
  flag) → calls `remove_source_from_all` then deletes.
- [ ] `GET …/sources` (or the `[sourceId]` GET) should include the `{ entries, sentences, texts }`
  reference counts so the management UI can render "used by N" without a second call.
- [ ] Entries endpoints already flow through `v1-entry-write`; strict error surfaces automatically.
- [ ] `lib/api/v1/openapi.ts` + `openapi.test.ts` — document the sources schema + endpoints + the
  strict-slug behavior; regenerate `openapi.json`.

### 5. Client writes + UI
- [ ] `lib/db/dict-client/dict-writes.ts` (+ `DictLiveDb`/`dbOperations`): `insert_source`,
  `update_source`, `delete_source` (writes to the `sources` table); a `remove_source_from_all` client
  op (strip slug from every referencing entry/sentence/text) for the danger-delete flow. Linking a
  source to an entry is just `save_entry({ sources: [...slugs] })` — NO junction op (sentence/text
  linking will work the same once those get UI).
- [ ] `lib/components/entry/EditSource.svelte` — NEW shared modal: form for
  slug/citation/abbreviation/author/year/url/license/type. Auto-slug from abbreviation (editable,
  uniqueness-checked). Used for both create + edit.
- [ ] `lib/components/entry/EntrySource.svelte` — rewrite: `ModalEditableArray`/`MultiSelect`-style
  picker with `options` = `page.data.sources` (value=slug, name=`abbreviation||citation||slug`), NO
  `canWriteIn`; a "＋ create new source" button opens `EditSource`, then links the new slug. Badges
  show abbreviation with citation tooltip.
- [ ] `routes/[dictionaryId]/sources/+page.svelte` + `+page.ts` — NEW management page: table of
  sources (with "used by N entries · M sentences · K texts" counts) + create/edit via `EditSource`.
  Delete is blocked while referenced; the row's delete opens a **danger confirm** ("Remove from all X
  references & delete") that runs `remove_source_from_all` then deletes. Reuse the existing danger
  confirm pattern (check `svelte-pieces`/existing delete confirms; e.g. type-to-confirm or a red
  modal).
- [ ] `routes/[dictionaryId]/SideMenu.svelte` — add a "Sources" nav item (sibling to grammar/about).

### 6. Cutover migration (Supabase → SQLite)
- [ ] `scripts/supabase-cutover/mappers.ts` (`map_entry` line ~163 copies `sources` verbatim) +
  `migrate.ts`: add a per-dict pass that (1) collects distinct free-text source strings, (2) inserts
  one `sources` row per distinct string (`slug = slugify(string)`, suffixed on collision;
  `citation = string`), (3) rewrites each `entry.sources` to the matching slug(s). Cover with a
  `migrate.test.ts` case.

### 7. i18n
- [ ] `en.json` — reuse existing `entry_field.sources`; add any new keys (e.g. `source.create`,
  `source.manage`, `source.citation`, `source.abbreviation`, `source.type.*`, facet label). Add to
  `en.json` only.

## Verification
- Unit: `v1-entry-write` strict-slug rejection (entries + sentences); `v1-sub-resources`
  create/update/unique-slug; `count_source_references` + `remove_source_from_all` +
  delete-refused-while-referenced; cutover `migrate.test.ts` free-text→slug; `augment-entry-for-search`
  emits `_sources` and drops sources from `_other`; `dictionary-json-columns` test (entries/sentences/
  texts include `sources`).
- svelte-look stories: `EditSource`, `EntrySource` picker, sources management table, `EntryFilters`
  source facet.
- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Once shipped
- The importer flips its citation helper to return the **slug** instead of the citation, then
  re-imports/patches.

## Notes / gotchas for the implementing session
- wa-sqlite sync invariants: clear `dirty` by pushed id only; `db_metadata` triggers use
  `ON CONFLICT DO UPDATE`; `/changes` fast-bail; `ensure_initial_sync()`.
- The four OPFS worker harness files are byte-identical across house/LD — don't touch them here.
- No FK on the `sources` arrays, but the strict-deletion policy (#12) guarantees no dangling slugs:
  a source can't be deleted while referenced, and the "remove from all & delete" path strips every
  reference first. Reference lookups use `json_each(<table>.sources)` across entries + sentences +
  texts.
- Sentences/texts get the `sources` column now but no UI — verify the column round-trips through
  sync/snapshot and JSON parse; the picker/facet for them is a later issue.
