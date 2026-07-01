# Entry-to-entry (+ sense-to-sense) relationships

Add first-class typed relationships between entries (optionally narrowed to senses)
**within a single dictionary**. Driving use case: import several closely-related
dialect/orthography sources as separate faithful entries in ONE dict, then link
cognates / dialectal variants across them.

Cross-**dictionary** linking is explicitly OUT of scope this round — we prove this
out intra-dict first, then design cross-dict separately (it has no FK / cascade /
snapshot home and needs its own subsystem).

## Scoping decisions (interview 2026-07-01)

- **Domain:** intra-dictionary only (rides existing FK cascade + snapshot/sync/history).
- **Deliverable:** schema + `/api/v1` relationship endpoints (POST / list / DELETE) +
  `include=relationships` on entry GET + a **read-only** "Related entries" section on the
  entry detail page (jump-link + human-friendly localized type). **No in-app editing UI.**
- **Table model:** ONE polymorphic `entry_relationships` table. `from_entry_id` /
  `to_entry_id` **required**; `from_sense_id` / `to_sense_id` **optional** (NULL =
  whole-entry relationship, set = narrowed to a meaning). A provided sense id must belong
  to its entry. (This is why we don't need a separate sense table nor collapse to pure
  sense-to-sense — entry-level types like `cognate` stay meaningful.)
- **Vocabulary — start small:** globals = `synonym`, `antonym`, `cognate`,
  `dialectal_variant` (all **symmetric** in the initial set). Directed-type machinery
  (inverse label, direction) is still built so future globals + custom directed types work.
- **Custom types:** per-dict `relationship_types` registry, found-or-created like tags,
  carrying label (+ optional inverse label) + symmetric flag. Dictionary-creator-authored,
  literal text in their language (NOT i18n).
- **Inverse:** store ONE row; derive the inverse at read time (also query
  `to_entry_id = X`) and render the inverse label. Symmetric types read identically from
  either side; directed types flip the label.
- **note / sources:** `note` = MultiString; `sources` = string[] of source slugs validated
  against the dict `sources` registry (reuse `assert_known_source_slugs`).
- **i18n:** global type labels + inverse labels are keys in `en.json` (translators fill the
  rest), resolved to the viewer locale. Custom labels are literal.
- **Display reach:** entry detail page only. List/gallery/print/table + Orama search =
  future.

## Data model (dict.db)

### New table `entry_relationships`

```sql
CREATE TABLE IF NOT EXISTS entry_relationships (
  id             TEXT PRIMARY KEY,
  from_entry_id  TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  from_sense_id  TEXT          REFERENCES senses(id)  ON DELETE CASCADE,
  to_entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_sense_id    TEXT          REFERENCES senses(id)  ON DELETE CASCADE,
  -- Exactly one of (type, custom_type_id) is set:
  type           TEXT,                                        -- global slug (constants)
  custom_type_id TEXT REFERENCES relationship_types(id) ON DELETE CASCADE,
  note           TEXT,   -- JSON MultiString
  sources        TEXT,   -- JSON string[] of source slugs
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK ((type IS NOT NULL) + (custom_type_id IS NOT NULL) = 1)
);
-- NULLs are distinct in a plain UNIQUE, so use a COALESCE expression index for dedupe:
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_relationships_natural
  ON entry_relationships(
    from_entry_id, COALESCE(from_sense_id,''), to_entry_id, COALESCE(to_sense_id,''),
    COALESCE(type,''), COALESCE(custom_type_id,''));
CREATE INDEX IF NOT EXISTS idx_entry_relationships_from ON entry_relationships(from_entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_to   ON entry_relationships(to_entry_id);
```

- **Symmetric-dedupe:** for a symmetric type, canonicalize endpoint order before insert
  (store the pair sorted by entry id, sense id as tiebreak) so A→B and B→A collapse to one
  row that the expression index catches. Directed types keep the given order.
- **Self-link:** reject when `from == to` at the same granularity (same entry AND same/both-
  null sense). Same entry, two *different* senses is allowed.

### New table `relationship_types` (custom, per-dict — like `tags`/`dialects`)

```sql
CREATE TABLE IF NOT EXISTS relationship_types (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,  -- JSON MultiString
  inverse_label TEXT,           -- JSON MultiString (directed custom types)
  symmetric     INTEGER,        -- 1 = symmetric, NULL/0 = directed
  dirty INTEGER,
  created_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

### Global vocabulary (constants.ts)

```ts
// slug → { symmetric, inverse_slug }; labels come from i18n (relationship_type.<slug>)
export const RELATIONSHIP_TYPES = {
  synonym:           { symmetric: true,  inverse_slug: 'synonym' },
  antonym:           { symmetric: true,  inverse_slug: 'antonym' },
  cognate:           { symmetric: true,  inverse_slug: 'cognate' },
  dialectal_variant: { symmetric: true,  inverse_slug: 'dialectal_variant' },
} as const
export type GlobalRelationshipType = keyof typeof RELATIONSHIP_TYPES
```

Future directed globals (documented, not built now): `hypernym`↔`hyponym`,
`holonym`↔`meronym`, `classifier_of`↔`classified_by`, `derived_from`↔`root_of`,
`borrowed_from`↔`loaned_to`, `spelling_variant` (sym), `see_also` (sym).

### i18n (en.json — add top-level `relationship_type` block)

```json
"relationship_type": {
  "synonym": "Synonym",
  "antonym": "Antonym",
  "cognate": "Cognate",
  "dialectal_variant": "Dialectal variant"
}
```

(Directed globals, when added, need both forward + inverse keys.)

## Migration

- File: `dictionary-migrations/20260701b_entry_relationships.sql` (sorts AFTER
  `20260701_sources.sql`: `'_'` < `'b'`). Contents:
  1. `CREATE TABLE relationship_types` + `CREATE TABLE entry_relationships` + indexes above.
  2. `last_modified_at` insert/update bump triggers for BOTH new tables (copy the existing
     per-table trigger pattern).
  3. **DROP + recreate `process_delete_cascade`** adding
     `DELETE FROM relationship_types … ` and `DELETE FROM entry_relationships …` lines
     (the trigger is a hardcoded table list — new tables MUST be added or tombstone
     deletes won't purge).
- Bump the dict schema-version sentinel:
  - `dict-client/dict-migrations-bundle.ts` — add the file + set `LATEST_DICT_MIGRATION`.
  - `lib/db/server/dictionary-db.ts` — set its `LATEST_DICT_MIGRATION`.
- Boot sweep (`hooks.server.ts`) applies it + stamps `dict_db_schema_version` on every dict.
- Update Drizzle schema `db/schemas/dictionary.ts` (add both tables) + json-column maps in
  `db/schemas/dictionary-json-columns.ts` (`entry_relationships.note`=MultiString,
  `.sources`=string[]; `relationship_types.label`/`.inverse_label`=MultiString).

### Sync wiring

- Add to `db/dict-syncable-tables.ts` `DICT_SYNCABLE_TABLES`, FK-safe (after `sources`):
  `'relationship_types'`, then `'entry_relationships'` (references entries/senses/
  relationship_types — must come last).
- Confirm `DictTableName` union + DictLiveDb accessor auto-expose the new tables (they key
  off `DICT_SYNCABLE_TABLES`). No client store code should need hand-editing beyond the type
  surface.

## Server write path — `db/server/v1-relationship-write.ts`

Mirror `v1-sub-resources.ts` / `v1-entry-write.ts` (all writes via `merge_dict_row` +
`record_history`, deletes via `run_tombstone_delete`):

- `find_or_create_relationship_type({ db, history_db, label, inverse_label?, symmetric?, user_id, api_key_id })`
  → dedupe by label name-key (like `find_or_create_tag`). Returns `{ type, created }`.
- `apply_relationship_create({ db, history_db, input, user_id, api_key_id })`:
  1. Validate `from_entry_id`/`to_entry_id` exist; sense ids (if any) belong to their entry.
  2. Resolve type: global slug in `RELATIONSHIP_TYPES`, else `custom_type` → find-or-create.
  3. Validate `sources` slugs; coerce `note` via `to_multistring`.
  4. Reject self-link; canonicalize order for symmetric types.
  5. Dedupe (return existing, `created:false`) else insert.
  Returns `{ relationship, created }`.
- `apply_relationship_delete({ db, history_db, id, user_id, api_key_id })` →
  `run_tombstone_delete('entry_relationships', id)`.
- `assemble_relationships({ db, entry_id })` → `RelationshipView[]` for the entry (query
  both `from_entry_id = ?` and `to_entry_id = ?`, resolve direction + label/inverse-label +
  the *other* entry's `lexeme` (+ first gloss) for the jump link).

`RelationshipView` (shared type, `lib/api/v1/…` or `lib/types`):
```ts
interface RelationshipView {
  id: string
  type: string                 // global slug or custom type id
  custom: boolean
  symmetric: boolean
  direction: 'forward' | 'inverse'
  label_key?: string           // global: i18n key; custom: resolve from label/inverse_label
  label?: MultiString          // custom types
  related: { entry_id: string, sense_id?: string, lexeme: MultiString, gloss?: MultiString }
  note?: MultiString
  sources?: string[]
}
```

## API endpoints (`/api/v1`)

- `POST /api/v1/dictionaries/[id]/relationships` — body
  `{ from_entry_id, from_sense_id?, to_entry_id, to_sense_id?, type?, custom_type?: { label, inverse_label?, symmetric? }, note?, sources? }`.
  `verify_auth_dict_role(event, id, 'editor')` (write). Returns `{ relationship, created }`
  + `mirror_dictionary_cursor` + `log_server_event`.
- `GET /api/v1/dictionaries/[id]/relationships?entry_id=…` — list for an entry (read access).
- `DELETE /api/v1/dictionaries/[id]/relationships/[relationshipId]` — delete by id (write).
- Entry GET (`…/entries/[entryId]/+server.ts`) — support `?include=relationships`; when
  present, attach `relationships: RelationshipView[]` (via `assemble_relationships`).
  (Consider the same flag on the entries LIST endpoint later; not this round.)
- `_call.ts` for each new route (`api_v1_…`), using `post_request`/`get_request`/`del`.
- Register paths + schemas in `lib/api/v1/openapi.ts` and reflect in the openapi.json route.

## Read-only display (entry detail page)

- New `routes/[dictionaryId]/entry/[entryId]/RelatedEntries.svelte`, rendered near the
  bottom of `EntryDisplay.svelte`.
- Reads **live** `page.data.dict_db` tables directly (no EntryData/Orama changes this round):
  `entry_relationships.query({ where: 'from_entry_id = ? OR to_entry_id = ?', params: [id, id] })`,
  resolve the other entry via `dict_db.entries.objects`, custom label via
  `dict_db.relationship_types.objects`, global label via i18n `relationship_type.<slug>`
  (+ inverse label for directed, chosen by which side `id` is on).
- Grouped by human-friendly type; each item is a link to `/[dictionaryId]/entry/<other_id>`.
- SSR note: relationships appear once dict_db loads (entry page already gates on that). SSR
  parity via EntryData is a deferred enhancement.

## Tests

- `db/server/v1-relationship-write.test.ts` (in-memory dict.db):
  create global + custom, idempotent dedupe (incl. symmetric reverse), sense-belongs-to-entry
  validation, self-link rejection, unknown type + unknown source-slug rejection, delete,
  entry-delete cascades the relationship, custom-type-delete cascades its relationships.
- Endpoint `server.test.ts` for POST / GET-list / DELETE / entry-GET `include=relationships`:
  401 no auth, 403 wrong role, 400 bad input, 404 missing entry, happy path + DB side-effect
  assertion (real JWT + `dictionary_roles` row, per api-endpoint skill).
- Migration test: open in-memory dict, assert both tables + FK cascade + trigger purge.
- `pnpm --filter site test`, `tsc`, `pnpm --filter site lint`, `pnpm --filter site check`.

## STATUS: ✅ Built + verified (first pass, incl. custom types). All green: 140 tests, tsc, lint, svelte-check.

### Verification (2026-07-01)
- **svelte-look** story (`RelatedEntries.stories.ts`) — isolated render covering every label case:
  global symmetric (Cognate), custom symmetric + note (Compare … "informal register"), and the
  **custom directed inverse** label resolving from the to-side ("adult of").
- **Live dev server + headless browser e2e** — seeded 4 relationships on a real local dict, logged
  in as admin via the dev OTP flow, loaded the real entry page: the migration synced into the
  browser wa-sqlite DB, the `DictLiveDb` Proxy accessors (`entry_relationships`/`relationship_types`)
  resolved, i18n labels + custom-type label + jump-link hrefs all rendered correctly, no component
  `pageerror`/console errors (only unrelated Google-GSI + Mapbox-dummy-token noise). Demo rows were
  cleaned up afterward; the applied migration was left (it's legitimate).

### Discoveries / deviations from the plan
- **No manual sentinel bump.** `LATEST_DICT_MIGRATION` (server + client bundle) is derived
  from the migration glob (sorted-last), and `DICT_JSON_COLUMNS` / `VALID_COLUMNS` are derived
  from the Drizzle schema. Adding the dated migration file + the two Drizzle tables was enough.
- **No `_call.ts` files.** `/api/v1/*` is the external REST API (API-key auth) — it has no
  client `_call` wrappers. The in-app display reads the live `dict_db` directly.
- **DictLiveDb auto-exposes new tables** via a Proxy over `DictTableName` (derived from the
  schema), so `dict_db.entry_relationships` / `.relationship_types` are typed + available with
  zero client-store edits.
- **`process_delete_cascade` is a hardcoded table list** — the migration DROPs + recreates it
  with the two new lines (verified by the cascade tests).
- **`resolve_owners` needed a case** for `entry_relationships` (fans history to BOTH entries).
- **Symmetric canonicalization ⇒ `direction` is not meaningful for symmetric types** — endpoints
  are stored sorted by (entry_id, sense_id), so which side is `from` depends on id order. Tests
  assert `related.entry_id` (always "the other endpoint"), not `direction`, for symmetric types.
- **`relationship_types` columns are `name` / `inverse_name`** (MultiString, matching
  `dialects.name`), not `label`/`inverse_label`.
- **i18n dynamic key cast**: `page.data.t` is literal-key-typed, so the component casts
  `relationship_type.${slug}` `as TranslationKeys` (the keys are real en.json entries).

## File checklist (✅ done)

- [ ] `db/schemas/dictionary-migrations/20260701b_entry_relationships.sql`
- [ ] `db/schemas/dictionary.ts` (+2 tables)
- [ ] `db/schemas/dictionary-json-columns.ts` (+ JSON cols)
- [ ] `db/dict-syncable-tables.ts` (+2 tables, FK-safe)
- [ ] `db/dict-client/dict-migrations-bundle.ts` + `db/server/dictionary-db.ts` (LATEST bump)
- [ ] `lib/constants.ts` (`RELATIONSHIP_TYPES`)
- [ ] `lib/i18n/locales/en.json` (`relationship_type` block)
- [ ] `lib/api/v1/relationship-input.ts` (input + `RelationshipView` types)
- [ ] `db/server/v1-relationship-write.ts` (+ test)
- [ ] `routes/api/v1/dictionaries/[id]/relationships/+server.ts` + `_call.ts` + test
- [ ] `routes/api/v1/dictionaries/[id]/relationships/[relationshipId]/+server.ts` + `_call.ts` + test
- [ ] `routes/api/v1/dictionaries/[id]/entries/[entryId]/+server.ts` (`include=relationships`)
- [ ] `db/server/build-entry-data.ts` or `assemble_relationships` helper
- [ ] `lib/api/v1/openapi.ts` (+ paths/schemas)
- [ ] `routes/[dictionaryId]/entry/[entryId]/RelatedEntries.svelte` + wire into `EntryDisplay.svelte`

## Deferred / future

- Cross-dictionary relationships (separate design once this proves out).
- ✅ Directed global types (2026-07-01, agent API feedback) — added `see_also` + `spelling_variant`
  (symmetric) and `hypernym`/`hyponym`, `holonym`/`meronym`, `derived_from`/`root_of`,
  `borrowed_from`/`loaned_to` (directed). Both members of each directed pair are POST-able; the
  inverse alias is canonicalized to its partner + endpoints flipped on write (`RELATIONSHIP_TYPES`
  gains an optional `canonical` field; `resolve_relationship_type` returns `flip`). Plain-English
  relational labels in `en.json`. openapi enum + `TranslationKeys` update automatically. Tests +
  story extended. See `.knowledge/domain/related-entries-model.md`.
- In-app editing UI (create/remove relationships).
- Relationships in EntryData/Orama → list/gallery/print/table + search + SSR parity.
- Custom-type management endpoints (rename/list/delete) — parallels tags if wanted.

## Knowledge to write on completion

- `.knowledge/domain/related-entries-model.md` is stale (describes an unbuilt parent/child/
  sibling model). Update it to document the shipped `entry_relationships` polymorphic table,
  one-row + derived-inverse choice, and the global-vs-custom type split.
