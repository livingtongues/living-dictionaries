# Dropping a column from a SYNCED table (safely)

Complements [adding-a-syncable-dict-table.md](./adding-a-syncable-dict-table.md). First done
2026-07-15 dropping `dictionaries.grammar` (structured-grammar cutover stage 2) — the first
`ALTER TABLE … DROP COLUMN` in any shared migration. It was safe; here's WHY, so the next one
doesn't re-derive it.

A synced table (in `SYNCABLE_TABLE_NAMES`) has copies on the server (better-sqlite3 `shared.db` /
dict.db) AND on every admin/editor client (wa-sqlite). A `DROP COLUMN` shared/dict migration runs on
**both** (the migration runner in `run-sql-migrations.ts` executes on server boot AND on each client's
local DB). Three things could bite — all three are fine:

1. **wa-sqlite supports `DROP COLUMN`.** The bundled build is SQLite **3.44.0** (`DROP COLUMN` landed
   3.35.0). Verify the exact build before trusting it: load `wa-sqlite/dist/wa-sqlite-async.mjs` in
   Node with `SQLiteESMFactory({ wasmBinary: readFileSync(<the .wasm>) })` (it `fetch`es the wasm
   otherwise), `CREATE TABLE … / ALTER TABLE … DROP COLUMN …`, confirm. Fails if the column is in an
   index/trigger/FK/generated-column — plain columns are fine even with unrelated indexes present.

2. **Version-skew during the deploy is tolerated by design — no server-side push helper needed.**
   The client push sends **whole rows** (`SELECT * FROM <table> WHERE dirty=1`, `engine.svelte.ts`),
   so an OLD client whose local schema still has the column will push it AFTER the server dropped it.
   The server's sync-apply already filters to schema-known columns (`sync-helpers.ts`:
   `allowed.has(c)` built from the Drizzle `getTableColumns` on the UPSERT + `strip_unknown_columns`
   on the pull response), so the stray column is silently dropped — no 500, no stuck dirty row. The
   old client self-heals on reload (its own drop-migration removes the local column → future pushes
   omit it). **This is the load-bearing invariant: keep sync column-filtering schema-driven.**

3. **Remove every read + drop it from the Drizzle schema** so `Tables<'…'>` loses the field and `tsc`
   finds stragglers. Don't edit the old `…_initial.sql` (migrations are append-only) — the fresh path
   is create-then-drop. Also purge non-type references `tsc` can't see: any writable-field allowlist
   (e.g. the catalog endpoint's `SCALAR_FIELDS`), `SELECT col, …` lists (prefer `SELECT *`, which is
   drop-safe), story mocks.

Verify: apply ALL shared migrations to a fresh in-memory better-sqlite3 DB and assert the column is
gone + no migration throws; `pnpm check`; full `pnpm vitest run`.
