# v1 API: writable entry + dialect `coordinates` + documented geometry schema

From agent feedback (2026-07-13): entry coordinates are readable (`entry.main.coordinates`)
but not writable via `/api/v1`, and the geometry shape is undocumented
(`type: object, nullable`). Use case: bulk imports of thousands of entries tagged with
elicitation/attestation points for map views + dialect geography.

## Decisions (Jacob-approved)
- **Strict validation**: lat ∈ [-90,90], lng ∈ [-180,180], finite numbers, regions ≥3
  vertices. A bad geometry fails just that item (existing SAVEPOINT per-item path on POST;
  400 on PATCH).
- **Limits**: ≤100 points, ≤20 regions, ≤100 vertices per region. Documented in spec.
- **PATCH = whole-object replace**: `{ points, regions }` overwrites; `null` clears;
  omitted → untouched. (No additive merge — matches other PATCH fields + GeoTaggingModal.)
- **`label`/`color` pass through** (validated as optional strings).
- **Dialect-level geometry TOO (Jacob 2026-07-13)**: dialects get their own `coordinates`
  column (same shape, same validator, same limits) — the variety's areal extent stored
  ONCE on the dialect row instead of repeating a polygon across thousands of entries.
  Entry-level = per-word attestation points; dialect-level = areal extent.
- Sense-level geometry stays future work.
- OpenAPI progressive disclosure (index + per-tag slices) deferred to `.issues/future/`.

## Shape (already the DB truth — `entries.coordinates` JSON column)
```jsonc
{
  "points": [{ "coordinates": { "longitude": 77.2, "latitude": 28.6 }, "label": "Khirsu", "color": "#f00" }],
  "regions": [{ "coordinates": [{...}, {...}, {...}], "label": "...", "color": "..." }]
}
```
Same shape as dictionary coordinates (`site/src/lib/types/coordinates.interface.ts`,
`DictionaryCoordinates` in `schemas/shared.types.ts`). UI writer: entry page
`GeoTaggingModal.svelte`.

## Implementation steps

1. ✅ **Validator** — new `site/src/lib/api/v1/coordinates-input.ts`:
   `to_coordinates(value): Coordinates | null | undefined` — `undefined` in → `undefined`
   (untouched), `null` in → `null` (clear), object in → validated/normalized
   `{ points?, regions? }` or **throw** with a precise message
   (`coordinates.points[3].coordinates.latitude must be between -90 and 90`, etc).
   Enforce caps (100 points / 20 regions / 100 vertices/region, min 3), finiteness,
   strip unknown keys, trim + drop empty `label`/`color`, drop empty result → `null`?
   No — empty `{ }` or `{ points: [] }` → `null` on PATCH / `undefined` on POST (via
   caller). Export constants `MAX_COORDINATE_POINTS` etc. Inline vitest or `.test.ts`.

2. ✅ **POST path** — `entry-input.ts`: add `coordinates?: Coordinates | null` to
   `EntryInput`. `v1-entry-write.ts` `build_entry()`: `coordinates: to_coordinates(entry.coordinates) ?? undefined`
   in the entries row (throw propagates → per-item `failed`).

3. ✅ **PATCH path** — `EntryPatch` gets the same field. `build_entry_patch_row()`:
   `if ('coordinates' in source)` → `row.coordinates = to_coordinates(...) ?? null`,
   `changed = true`. (`entries` is already in `DICT_JSON_COLUMNS`, so serialization +
   sync + history just work.)

4. ✅ **OpenAPI spec** (`openapi.ts`):
   - Add `components/schemas`: `LngLat` (`longitude`/`latitude`, ranges), `GeoPoint`
     (`coordinates` + optional `label`/`color`), `GeoRegion` (`coordinates` array,
     minItems 3, maxItems 100), `Coordinates` (`points` maxItems 100, `regions`
     maxItems 20) with descriptions covering points-vs-regions semantics + PATCH
     replace/null-clears/omit-untouched.
   - Reference from `EntryInput`, `EntryPatch`, `EntryMain` (replacing the bare
     `type: object`), and the dictionary metadata response if it has a coordinates prop.
   - Mention geo-tagging briefly in the info Data-model prose.

5. ✅ **Dialect coordinates — schema migration** (read the `database` skill first):
   - `dictionary-migrations/20260713_dialect_coordinates.sql`:
     `ALTER TABLE dialects ADD COLUMN coordinates TEXT;` (runs on server dict DBs AND
     every client wa-sqlite DB via the migrations bundle — same file, both sides).
   - `schemas/dictionary.ts` dialects table: `coordinates: text({ mode: 'json' }).$type<DictionaryCoordinates>()`.
   - `DICT_JSON_COLUMNS.dialects` → `['name', 'coordinates']` (+ its test at
     `dictionary-json-columns.ts:61`). Sync/history need nothing else — dialects is
     already a syncable table.

6. ✅ **Dialect coordinates — v1 API** (`v1-sub-resources.ts` + routes):
   - `DialectRecord` gains `coordinates: Coordinates | null`; `list_dialects` returns it
     (parse_dict_row already handles it once JSON_COLUMNS updated).
   - `POST …/dialects` (create) + `PATCH …/dialects/{id}` accept `coordinates` via
     `to_coordinates` (PATCH: replace / null-clears / omit-untouched, like entries).
   - Entry write paths (`build_entry` found-or-create + PATCH additive links) stay
     name-only — geometry is set via the dialect endpoints, not entry payloads.
   - Entry READ shape's `dialects[]` + `EntryFull` spec: include `coordinates`.
   - OpenAPI: dialect input/patch/record schemas reference `#/components/schemas/Coordinates`;
     prose note: entry coords = attestation points, dialect coords = areal extent.

7. ✅ **UI parity (dialect geometry)**: entries already have GeoTaggingModal; dialects
   have NO management UI for coordinates. Per the human/agent-parity direction, plan the
   surface: reuse GeoTaggingModal from wherever dialects are edited (likely the entry
   page's dialect editor or a future dialects manager). If out of scope for this pass,
   record as a follow-up `.issues/` item — confirm with Jacob.

8. ✅ **Tests** — `v1-entry-write.test.ts`: POST with valid points+regions round-trips;
   invalid lat fails ONLY that item; over-cap fails; PATCH replace; PATCH null clears;
   PATCH omit untouched. Dialect tests in `dialects` route server.test.ts /
   `v1-sub-resources.test.ts`: create-with-coordinates, patch replace/clear, read-back in
   list + entry shape. `openapi.test.ts` — schema presence if that's its pattern.

9. ✅ **Verify**: `pnpm test` (v1 + coordinates + openapi + sub-resources), `tsc`, lint,
   `pnpm check`. Manually verify the migration applies to an existing local dict.db.

10. ✅ **Future note** — `.issues/future/openapi-progressive-disclosure.md`: spec is ~100KB
   (~25-30k tokens) served in one blam; when it hurts, add `?view=index` (paths+summaries)
   and per-tag slices from `build_openapi_spec`.

## Status
✅ IMPLEMENTED (2026-07-13). All steps done + verified.

### What shipped
- `$lib/api/v1/coordinates-input.ts` — strict `to_coordinates()` validator (inline vitest).
- Entry POST + PATCH accept `coordinates` (`entry-input.ts`, `v1-entry-write.ts`).
- Dialect coordinates: migration `dictionary-migrations/20260713_dialect_coordinates.sql`
  (schema_version auto-derived from filename — no manual bump), `dictionary.ts` +
  `DICT_JSON_COLUMNS` (auto-derived; test updated), `v1-sub-resources.ts`
  (`DialectRecord.coordinates`, create + `apply_dialect_update` w/ `has_coordinates`),
  dialect POST/PATCH routes.
- Entry READ shape: `EntryData.dialects[].coordinates` typed; flows through `build_entry_data`.
- OpenAPI: `LngLat`/`GeoPoint`/`GeoRegion`/`Coordinates` schemas + refs on EntryInput/
  EntryPatch/EntryMain/EntryFull.dialects + dialect POST/PATCH bodies + data-model prose.
- Tests: coordinates-input inline, v1-entry-write (POST valid/fail-isolation/cap, PATCH
  replace/clear/omit/invalid), v1-sub-resources (dialect create/list/patch), dialect
  route server.test (set/clear/400), openapi key-inventory updated.

### Verified
- `pnpm vitest` (209 v1 tests pass), `tsc --noEmit` clean, eslint clean on changed files,
  `pnpm check` 0 errors. Migration applied to a copy of real `achi.db` — column added +
  JSON round-trips.

### Follow-ups filed
- `.issues/future/dialect-coordinates-ui.md` — human UI for dialect geometry (reuse GeoTaggingModal).
  ✅ DONE 2026-07-13 — dialects manager on the Settings page.
- `.issues/future/openapi-progressive-disclosure.md` — spec slicing + sense-level geometry note.
  ✅ DONE 2026-07-13 — `?view=index` + `?tag=<name>` shipped. (Sense-level geometry still future.)
