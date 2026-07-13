# ✅ DONE (2026-07-13): human UI for dialect coordinates

Shipped a full dialects manager on the dictionary **Settings** page (editor+ gated).
See "What shipped" at the bottom.

---

# Future: human UI for dialect coordinates

The v1 API now lets an agent set a dialect's `coordinates` (areal-extent geometry)
via `POST/PATCH …/dialects` (see `.issues/v1-entry-coordinates.md`), and the entry
READ shape returns each dialect's `coordinates`. But there is **no human-side UI** to
edit a dialect's geometry — in fact dialects have no dedicated management UI at all
(they're currently only found-or-created by name through entry editing + the API; even
renaming is API-only).

Per the human/agent editing-parity direction (AGENTS.md), a human should be able to do
this too.

## Plan when picked up
- A dialects manager surface (list the dictionary's dialects; rename; edit geometry;
  delete) — likely reachable from the dictionary settings/home, or a dialect chip on
  the entry page.
- Reuse the existing `GeoTaggingModal.svelte`
  (`src/routes/[dictionaryId]/entry/[entryId]/`) — it already edits the identical
  `{ points, regions }` shape for entries; point it at a dialect row instead.
- Write path: dialects live in dict.db (`DictLiveDb`), so a scalar `_save()` of the
  `coordinates` field on the dialect row (same live-row pattern as entry coordinates in
  `EntryMedia.svelte`).

Small, self-contained; deferred only because the API/import use case is fully served
without it.

## What shipped (2026-07-13)
- **`src/routes/[dictionaryId]/settings/DialectsManager.svelte`** — a "Dialects" section
  on the Settings page (rendered `{#if can_edit}`). Lists every dictionary dialect from the
  reactive `page.data.dialects` store (rows now carry parsed `coordinates` because the read
  bundle is `SELECT *` + `parse_dict_row`, and `dialects.coordinates` is in `DICT_JSON_COLUMNS`).
  Per row: rename (reuses `EditString`), **Map area (N)** button that opens the existing
  **`GeoTaggingModal`** (reused verbatim — same `{ points, regions }` shape as entries) to add/
  edit points & regions, and delete.
- **Writes** go straight through the live-row API (same precedent as entry coordinates in
  `EntryMedia.svelte`): `dict_db.dialects.update({ id, name })` / `({ id, coordinates })` and
  `dict_db.dialects.delete(id)`. No new guarded-write methods needed. Delete cascades the
  `entry_dialects` junction via the schema FK (`onDelete: 'cascade'`) + sync tombstoning, exactly
  like `delete_entry` — a deleted dialect just drops off every entry.
- i18n keys added under `settings.*` (`dialects_heading`, `dialects_meaning`, `no_dialects`,
  `edit_dialect_area`, `delete_dialect_confirm`) in `en.json`.
- `DialectsManager.stories.ts` (svelte-look) — WithDialects + Empty, verified light + dark.
- Verified: `pnpm check` 0 errors, eslint clean, svelte-look screenshots.
