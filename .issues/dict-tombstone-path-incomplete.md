# Dict.db: move from soft-delete (`deleted` column) to hard-delete tombstones

**Status:** ✅ CODE COMPLETE + verified (tests/tsc/lint/local-data-migration). The hard-delete flow is
now also **exercised by the e2e suite** (2026-06-06b, livedb-scalar-field-migration work): `test:db`
section C (add sense → delete sense via the real UI) and `test:flow` (add Sense 2 → delete it → sync →
reload-from-server confirms it stays gone + the original sense survives) drive the tombstone trigger +
FK cascade + sync round-trip against the real server SQLite, with no uncaught page errors. A focused
manual smoke of the entry-level trash button on the dev server is the only bit left to Jacob.
Direction (2026-06-06): hard-delete (tutor model). No restore feature; history is a SEPARATE future task.

> ⚠️ The e2e `.data/dictionaries/achi.db` fixture had `e_ja` hard-deleted at some point during the
> hard-delete smoke-testing (tombstone dated 13:49:57Z; left achi at 12 entries). Restored on
> 2026-06-06b by rebuilding achi.db from `.data/dictionaries.old-soft-delete-schema/achi.db` using the
> per-file copy logic from `scripts/migrate-dict-dbs-hard-delete.mjs` (→ 13 entries, `e_ja`=`haʔ`, 0
> tombstones). The e2e flows are now net-zero so this shouldn't recur from automated runs.

## Done (2026-06-06)
- ✅ Renamed+rewrote `dictionary-migrations/20260605...`/`20260525_initial.sql` → single
  `20260606_initial.sql` (dropped `deleted` col + indexes; hard-delete `process_delete_cascade`
  trigger; folded in the `ON CONFLICT(key)` lmod-bump fix; lmod bump inside the cascade trigger).
- ✅ Drizzle `dictionary.ts`: dropped all 19 `deleted` columns.
- ✅ Client write: `DictLiveDb.#delete`/`#delete_cb` → tombstone; table-store query no longer filters
  `deleted`; `operations.ts` link/unlink/delete_sentence + new `delete_entry/sense/photo/audio/video`.
- ✅ Sync: server `if (!exists)` PULL guard; client engine `on_rows_deleted` collects pulled deletes.
- ✅ Search: `rows_deleted` broadcast → `subscribe_deletes` → `apply_rows(changes, deletes)` rebuilds
  removed rows from worker maps. `read-dict-bundle` drops `WHERE deleted IS NULL`.
- ✅ Snapshot builder strips `deletes` before gzip (defensive table-exists check).
- ✅ rpc-types `RowsDeletedBroadcast`; `dict-connection.execute` affected_tables override.
- ✅ UI: 8 soft-delete call sites → hard `delete_*`; `dbOperations` barrel + mock updated.
- ✅ Tests updated (dict-sync hard-delete + peer-propagation); `pnpm test` 369 pass, `pnpm check` 0
  errors, lint 0 errors. Verified FK cascade + tombstone + lmod bump on a real in-memory DB.
- ✅ Local data: set aside `.data/dictionaries` → `.data/dictionaries.old-soft-delete-schema`; wrote
  + ran `site/scripts/migrate-dict-dbs-hard-delete.mjs` (2158 DBs rebuilt on new schema, 104318 rows
  copied, 36 soft-deleted purged, 0 fail). NO Supabase re-pull. Old dir preserved.

## NOT done (per Jacob: "don't worry about clients or VPS")
- Client OPFS wipe mechanism (none — few pre-prod clients; clear site data if needed).
- VPS reset / R2 snapshot invalidation (VPS has no important data).
- Media-byte (GCS/R2) cleanup on hard-delete (separate orphan sweep — flagged below).
- Tombstone pruning (>60d) — later.

## Decision (was the open question)
Convert dict.db deletions from the current **soft-delete** model (`deleted TEXT` column + a
`process_delete_cascade` trigger that *UPDATEs* `deleted`) to tutor's **hard-delete tombstone**
model (`INSERT INTO deletes` fires a trigger that *DELETEs* the row; FK `ON DELETE CASCADE` sweeps
children). Rows are truly purged → DBs stay small → deletes propagate to every peer + snapshots.

### Why this is safe re: the original "resurrection on snapshot" fear
That fear assumed a hard-delete client path against a server that never deletes its own row. Once the
**server** trigger truly `DELETE`s, the raw `.backup()` snapshot is taken from a DB where the row is
already gone — so nothing to resurrect. No snapshot reconcile needed.

## Key discovery
LD dict.db ALREADY has a `deletes` table + `process_delete_cascade` trigger — but it's a **SOFT**
trigger (`UPDATE … SET deleted = NEW.updated_at`), unlike tutor's **HARD** trigger
(`DELETE FROM … WHERE id = NEW.id AND NEW.table_name = '…'`). The client currently bypasses the
`deletes` table entirely and writes the `deleted` column directly (2026-06 change in
`dict-live-db.svelte.ts#delete_cb`). So today it's soft-delete end-to-end and DBs only grow.

Tutor reference: `process_delete_cascade` trigger in
`~/code/tutor/site/src/lib/db/schemas/shared-server-migrations/20260414_initial.sql:307`. Client
delete: `live-db.svelte.ts#create_delete_callback` (`INSERT INTO deletes` + local `DELETE FROM`).
Server: `sync-helpers.ts` `INSERT OR REPLACE INTO deletes` (fires trigger) + PULL forwards tombstone
only `if (!exists)`.

## Approach: rewrite + rename initial SQL (NOT a follow-on migration). NO data preservation.
There's only one dict migration (`20260525_initial.sql`). Rewrite it AND rename to
`20260606_initial.sql`. **Jacob (2026-06-06): "Don't worry about clients or VPS state. No one is
using it yet and the vps has no important data."** ⇒ NO data-copy script, NO Supabase re-pull, NO R2
snapshot invalidation, NO client OPFS rebuild mechanism. Just the code change + wipe local
`.data/dictionaries/*` so dev rebuilds fresh on the new schema. Pure code task + tests.

## Scope decisions (confirmed)
- Drop the `deleted` column entirely (+ partial indexes + all `WHERE deleted IS NULL` filters). Q1=drop.
- Media bytes (GCS/R2) on hard-delete of a photo/audio/video row: OUT of scope (separate orphan
  sweep). Q2=out.
- Server tombstone pruning (>60-day snapshot window): LATER. Q3=later.

## Work plan

### 1. Schema — rewrite `dictionary-migrations/20260525_initial.sql`
- [ ] Remove `deleted TEXT` from all 19 content tables.
- [ ] Remove every `idx_*_deleted` partial index (`WHERE deleted IS NULL`).
- [ ] Replace `process_delete_cascade` trigger body: each line `UPDATE <t> SET deleted=…` →
      `DELETE FROM <t> WHERE id = NEW.id AND NEW.table_name = '<t>'`. With FK `ON DELETE CASCADE`
      already in place (entry→senses→junctions etc.; texts→sentences is `SET NULL`), deleting the
      named parent row cascades to children. Keep child-before-parent ordering defensively.
- [ ] DECIDE: rename file to `20260606_initial.sql`? (clean LATEST_DICT_MIGRATION bump). Drizzle
      schema `dictionary.ts` mirrors this — drop the 19 `deleted: text()` lines + doc comment.
- Client migration bundle (`dict-migrations-bundle.ts`) auto-regenerates from the `.sql` glob — no
  manual step. Server `LATEST_DICT_MIGRATION` derives from filename too.

### 2. Client write path
- [ ] `dict-live-db.svelte.ts#delete_cb` / `#delete` / `_delete`: revert soft-stamp → tutor-style
      `INSERT INTO deletes(table_name, id)` (+ belt-and-braces local `DELETE FROM`). Trigger also
      fires locally. Update the long comment block (lines ~413-422).
- [ ] Table-store queries: drop `WHERE deleted IS NULL` (column gone). `#get_table_store` line 290,
      `read-dict-bundle.ts:29`, any query accessors.
- [ ] `operations.ts`: `unlink_junction` → tombstone (not `update({deleted})`); `link_junction` →
      just insert fresh (no revival needed); `delete_sentence` → tombstone.

### 3. Sync engine
- [ ] Client `dict-sync-engine.ts`: already pushes/drains/applies `deletes`. Now actually populated.
      Verify `#apply_response` delete path + notifier surfaces deleted ids to the search feed (see #4).
- [ ] Server `dictionary-sync-helpers.ts` `process_dict_changes`: PUSH already `INSERT OR REPLACE
      INTO deletes` (fires hard trigger now). Add tutor's `if (!exists)` guard in the tombstone PULL
      so a re-created id doesn't carry a stale delete.

### LOCKED DESIGN for delete→search propagation (approach 1-lite)
Feed deletes to the Orama index via an out-of-band **delete-event channel**, NOT the `updated_at`
scan (hard-deleted rows vanish from that scan). Keep `deletes` a pure push-queue (drained by DELETE).
- `DictLiveDb.#delete`: `INSERT INTO deletes(table_name,id)` (trigger hard-deletes + FK cascade). Emit
  `#notify_deletes([{table_name,id}])` to local delete-subscribers + notify content tables locally;
  pass `affected_tables` override so cross-tab table stores refresh.
- Sync engine `#apply_response`: collect pulled-delete `{table_name,id}` → `on_rows_deleted` callback →
  SharedWorker broadcasts new `rows_deleted` message → each tab's DictLiveDb → delete-subscribers.
- `orama-watcher`: `dict_db.subscribe_deletes(...)` buffers `{table,id}` → passes to `apply_rows`.
- `entry.worker apply_rows(changes, deletes?)`: for each delete, reconstruct the row from the worker's
  in-memory maps (resolves entry_id), then run the existing remove logic.
- Snapshot builder: `DELETE FROM deletes` on the backup before gzip (else fresh clients re-push the
  server's whole tombstone log).
- KNOWN MINOR GAP (accepted, pre-prod): a tab does NOT learn of ANOTHER tab's *local* delete for its
  search index until reload (cross-tab table stores DO refresh; remote-pulled deletes DO propagate).

### 4. Search / Orama index (TRICKIEST — verify carefully)
Today incremental indexing keys off `row.deleted` (`entry.worker.ts:155` `is_deleted = !!row.deleted`,
`orama.worker.ts:49`). With hard-delete the row simply vanishes, so the indexer must instead consume
**delete events (table+id)**. Trace `orama-watcher.ts` → worker `apply_rows`; feed pulled-delete ids
(from sync engine `#apply_response` + local `#delete`) so the worker removes them from the index.
`read-dict-bundle.ts:29` full-rebuild query drops the `WHERE deleted IS NULL`.

### 5. Types + UI
- [ ] `src/lib/types/*` (entry/video/content-update/db.ts) — drop `deleted`.
- [ ] UI comps referencing `deleted`: GalleryEntry, ListEntry, table/Cell, entry/+page, EntryMedia,
      EntryDisplay — most just read it for filtering; remove now-dead checks.
- [ ] `introspect.ts`, `reconcile-rows.ts`, `opfs-lru.ts` references.

### 6. Data copy / reset script (`scripts/` one-off)
For each existing server dict.db (local `.data/dictionaries/*.db`; VPS
`/opt/hosting/data/dictionaries/*.db`):
- [ ] Rename old → `*.db.old` (set aside; do NOT delete until verified).
- [ ] Open fresh `{id}.db` via `open_dictionary_db` (runs new SQL → new schema).
- [ ] ATTACH old; per syncable table `INSERT INTO new SELECT <cols except deleted> FROM old
      WHERE deleted IS NULL` (purges soft-deleted rows in the move).
- [ ] Carry `db_metadata` (`dictionary_id`; set `last_modified_at = max(updated_at)`).
- Big-data dicts locally: `gta, apatani, torwali, matukar, nukuoro` (+ medium: svetsian, a-fala,
  achi, 80Cc…). ~2158 mostly-empty on-demand DBs locally — those can just be deleted (recreate fresh).

### 7. Reset clients (OPFS) + R2 snapshots
- [ ] R2 dict snapshots are stale (old schema). Invalidate: clear `dictionaries.snapshot_uploaded_at`
      + delete R2 snapshot objects so the cron rebuilds from new-schema server DBs. Bump
      `dict_db_schema_version` (auto on dict-db open).
- [ ] Existing client OPFS DBs have old schema; an in-place re-run won't fix them (must force_delete +
      refetch). DECIDE the trigger (see open Q below). Pre-prod = few clients.

### 8. Tests
- [ ] Update: `dictionary-sync.test.ts`, `dict-migrations-bundle.test.ts`,
      `r2-snapshot-builder.test.ts`, dict live-db tests. Add a hard-delete-propagation test mirroring
      tutor `sync-helpers.test.ts` #9-12.
- [ ] `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Open questions for Jacob (see chat)
- Rename migration file to today's date? (recommend yes)
- Client OPFS rebuild trigger: manual site-data clear (pre-prod, simplest) vs auto force_delete on
  schema_outdated-when-no-pending-writes (reusable but discards unsynced writes if misused).
- Confirm copy-script-over-Supabase + VPS reset procedure (I'll do SSH steps once local is verified).

## Touch points (files)
- `src/lib/db/schemas/dictionary-migrations/20260525_initial.sql`, `schemas/dictionary.ts`
- `src/lib/db/dict-client/dict-live-db.svelte.ts`, `operations.ts`, `dict-sync-engine.ts`
- `src/lib/db/server/dictionary-sync-helpers.ts`, `r2-snapshot-builder.ts`, `dictionary-db.ts`
- `src/lib/search/{read-dict-bundle,orama.worker,entry.worker}.ts`, `orama-watcher.ts`
- `src/lib/types/*`, dict UI comps under `routes/[dictionaryId]/`
- `.knowledge/migration/dict-sync-invariants.md` (update once landed)

## Note (out of scope but flagged)
LD admin `shared.db` `sync-helpers.ts` has the SAME soft-vs-hard ambiguity (its `if (!exists)` PULL
guard assumes a hard delete that its server-side may not perform for every table). Separate DB —
leave untouched unless Jacob asks.
