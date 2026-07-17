# Adding a new syncable table (or JSON column) to `dictionaries/{id}.db`

Distilled from the `sources` registry addition (`.issues/sources-model.md`). A new per-dict
content table doesn't "just work" from the Drizzle schema — it must be registered in ~7 places, and
the delete-cascade trigger needs a **DROP + re-CREATE** because SQLite has no `ALTER TRIGGER`.

> Historical filenames cited below (`20260701b_entry_relationships`, the `20260702_…repair`)
> were folded into the single `20260702_initial.sql` by the pre-cutover squash
> (see `migration-squash-2026-07-02.md`) — the patterns they illustrate still apply verbatim.

## The checklist (in order)
1. **Drizzle schema** — add the `sqliteTable(...)` in `src/lib/db/schemas/dictionary.ts`.
2. **New dated migration** in `dictionary-migrations/` (NEVER edit an already-applied one — the
   runner tracks applied files by name, and prod/local DBs already ran the earlier ones). Include:
   - `CREATE TABLE IF NOT EXISTS …` + indexes.
   - The two `<table>_after_insert_bump_lmod` / `_after_update_bump_lmod` triggers (bump
     `last_modified_at` via `INSERT … ON CONFLICT(key) DO UPDATE` — never `INSERT OR REPLACE`).
   - **`DROP TRIGGER IF EXISTS process_delete_cascade; CREATE TRIGGER … ( … + DELETE FROM <table>
     WHERE id = NEW.id AND NEW.table_name = '<table>'; … )`** — re-declare the WHOLE cascade with
     the new line added. SQLite can't `ALTER TRIGGER`, and the cascade is one hard-coded per-table
     `DELETE` list. Keep it byte-identical to the prior version except the added line.
   - Adding a **column** to an existing table = `ALTER TABLE <t> ADD COLUMN <c> TEXT;` (fine inside
     the migration's `BEGIN…COMMIT` for a nullable column; JSON columns are stored as `TEXT`).
3. **`dict-syncable-tables.ts`** — add the name to `DICT_SYNCABLE_TABLES` (FK-safe order).
4. **`types/db.ts`** — add it to the `TableModels` interface so `Tables<'x'>` /
   `DictTableName` resolve (the client `dict_db.<table>` Proxy then works with no extra wiring).
5. **`dictionary-json-columns.ts`** — no code change (it's derived from the schema), but UPDATE the
   inline vitest expectations for any table whose JSON-column set changed.
6. **Search feed (only if it affects entries/the Orama doc)** — `read-dict-bundle.ts` `DATA_TABLES`
   (so the bundle + watcher include it), the worker `entry.worker.ts` (`SYNC_TABLE_ORDER`,
   `apply_one` case, `find_row_by_id`, init load + a `set_x`), `entries-ui-store.ts`,
   `search/index.ts` (proxy the new setter — ORDER of positional args must match the worker's
   `init_entries` signature), and `[dictionaryId]/+layout.ts` to surface it on `page.data`.

## Verification that catches the misses
`open_dictionary_db_in_memory(...)` in a vitest runs the real migration set, so any server-side
`v1-*.test.ts` that seeds the new table proves the migration (table + columns + triggers) works
without a browser. The `dictionary-json-columns.ts` inline test guards the JSON-column registry.

## The stale-draft trap (bit us on `20260701b_entry_relationships`)
"Never edit an already-applied migration" includes **your own migration while you develop it**: the
dev server applies + records the file on first dict open, so anything you add to that same file
afterwards silently never runs (the runner skips it by name). Symptom found 2026-07-02: the dev
DB's `process_delete_cascade` trigger was still the pre-draft version — relationship deletes
tombstoned into `deletes` but the row survived, and because the client retry is `INSERT OR IGNORE
INTO deletes`, the trigger never re-fired → **permanently undeletable rows**. Fix pattern
(`20260702_relationship_delete_cascade_repair.sql`): a new migration that (a) re-declares the final
trigger byte-identically (idempotent on healthy DBs) and (b) **sweeps rows that already have
tombstones** (`DELETE FROM <t> WHERE id IN (SELECT id FROM deletes WHERE table_name='<t>')`) —
without the sweep, stale-window rows stay undeletable forever. While iterating locally, either
bump the migration filename on each edit or delete the `migrations` row + revert the DDL by hand.

## sources-specific note (facet-not-junction)
`sources` is a registry table but entries/sentences/texts reference it by a **slug array column**,
NOT a junction — so the worker needs NO grouping map for it. The slugs are already on the entry doc;
`augment-entry-for-search` emits `_sources` (facet-only, deliberately dropped from the `_other`
full-text field), and the worker's `set_sources` only refreshes `page.data.sources` for label
resolution (chips/facet/picker) — editing a source never re-indexes entries.
