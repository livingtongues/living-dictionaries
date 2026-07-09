# Sync FK-wedge: server_seq cursor (root fix) + client self-heal + push-side orphan recovery

## The incident
Admin + dict clients wedge with `FOREIGN KEY constraint failed` at sync-apply COMMIT, retrying
forever (circuit breaker halts at 3 with a useless "reload" prompt). Jacob manually deleted his
local DB to recover. Prod telemetry (14d): admin engine 17 failures / 2 users (Jacob f0fdbb2f,
Diego b083633c — Diego still wedged with a 1,692-row delta); dict engine 145 failures / 3 users
hot-looping on `sugtstun` every ~30min for 2 days.

## Root cause (verified)
Server DBs are FK-clean (`PRAGMA foreign_key_check` = 0 on prod shared.db AND sugtstun.db).
The corruption is each client's **delta view**:

- Both engines pull `WHERE updated_at > cursor`, but merged rows keep the **client-supplied**
  `updated_at` (the LWW arbiter). A row pushed with a stamp older than another client's cursor
  is INVISIBLE to that client forever.
- Same-millisecond strict-`>` ties add a second (smaller) miss window.
- When a *child* of the missed row later rides down, the client's deferred-FK check explodes at
  COMMIT → whole apply rolls back → wedged until the missing parent coincidentally gets bumped
  (Jacob's wedge self-cleared twice — that's why).

Secondary hole (noted, partially addressed): server's `process_delete_cascade` trigger + FK
cascades delete CHILD rows without tombstoning them; clients that miss the parent tombstone
(zombie re-created dicts `river`/`hittite` suppress it via the `if (!exists)` skip) keep stale
child rows forever. The self-heal rebuild prunes these.

## Decisions (Jacob)
- Do ALL of it: self-heal both engines + server-seq root fix + push-side orphan port.
- Self-heal fully automatic, no prompt (dirty rows preserved / already on server).
- Heal on the **2nd consecutive** FK failure (before the breaker halts at 3).
- Cursor = integer per-DB monotonic `server_seq` (Q-stamp A); transition = one-time full
  re-pull / snapshot reset (Q-transition A).

## Design

### 1. server_seq cursor (both shared.db and dict.db)
- `server_seq INTEGER` column on every syncable table + `deletes`.
- One-row counter table `server_seq_counter(seq INTEGER NOT NULL)`.
- AFTER INSERT + AFTER UPDATE triggers per table: bump counter, assign
  `server_seq = counter` to the row. recursive_triggers is OFF (default) so the
  self-UPDATE doesn't re-fire. MUST TEST: FK actions (SET NULL / CASCADE) fire these
  triggers (SQLite fires triggers for FK actions independent of recursive_triggers —
  verify empirically in a unit test; if not, cascaded SET NULL rows would be invisible
  to pull = the original bug again).
- Backfill: per table `SET server_seq = rowid`; counter = max across tables.
- Pull: `WHERE server_seq > ?` ORDER BY server_seq; `new_synced_up_to = counter value`
  (exact under BEGIN IMMEDIATE).
- `updated_at` remains purely the LWW arbiter — semantics unchanged.
- Server strips `server_seq` from pushed rows in merge (like `dirty`).
- Client stores cursor in `db_metadata['synced_seq']`. Fresh snapshot: builder bakes
  `synced_seq` (= counter at build time) into the snapshot's db_metadata.
- Migration handshake (new .sql on both) force-reloads all stale bundles — existing mechanism.

### 2. Transition + self-heal share one rebuild path
- **Admin engine**: `full resync` = sync with cursor null + post-apply prune (delete local
  non-dirty rows absent from the full response, per table, single deferred-FK txn). Push rides
  the same request so dirty rows are never lost. Used both for transition (no `synced_seq` yet →
  cursor null anyway = initial-sync cost, already accepted at onboarding) and FK self-heal.
- **Dict engine**: `rebuild()` on the instance = flush-push-only (dirty rows → server; response
  discarded) then existing `reset()` (delete OPFS file → fresh snapshot → sync). Triggered by
  (a) FK self-heal (2nd consecutive), (b) transition: post-migration file lacking `synced_seq`.
  Viewer / no-dirty = plain reset. NOTE: a failed sync has ALREADY pushed dirty rows server-side
  (server commits push+pull in its own txn; the failure is local apply) — flush covers only
  mid-flight writes since.
- New failure kind `fk_constraint` in classify (non-transient, error level). Engines track
  consecutive count; heal at 2, breaker still halts at 3 if healing itself fails.

### 3. Push-side orphan recovery for admin
Port `process_dict_changes`' identify-orphans/skip/retry wrapper to `process_sync`
(shared.db). Response gains optional `skipped_orphans`; client logs a warn.

### 4. snapshot_expired under seq cursors (dict)
Tombstone pruning records `pruned_up_to_seq` in dict db_metadata; endpoint returns 410 when
request cursor < that. (Find current pruning + expiry logic — r2-snapshot-builder / changes
endpoint.)

## Implementation checklist — ALL DONE ✅
- ✅ Migrations: shared + dict `20260709_server_seq_sync_cursor.sql` (columns, counter, triggers
     with WHEN guard, rowid backfill, indexes). Dry-run on PROD copies: shared 88ms,
     sora-language-project (48MB) 987ms, 0 FK violations.
- ✅ Drizzle schemas: server_seq on all syncable tables + deletes (both DBs)
- ✅ sync-helpers.ts: seq pull, counter watermark, strip server_seq, orphan-skip port
     (identify/skip/retry + `skipped_orphans` in response, warn-logged by both endpoints)
- ✅ dictionary-sync-helpers.ts: seq pull, counter watermark, strip server_seq,
     `read_server_seq_counter` export; endpoint fast-bail on counter; `snapshot_expired` =
     `cursor < pruned_up_to_seq`; mirror now reads post-write `last_modified_at` (mirror stays ISO)
- ✅ r2-snapshot-builder: records `pruned_up_to_seq` before pruning; `bake_synced_seq` into
     snapshots; `/db` endpoint bakes too AND now strips `deletes` (bonus bug: editors bootstrapping
     from /db re-pushed the whole server tombstone history)
- ✅ sync/types.ts numeric cursors + skipped_orphans; SyncRow makes server_seq/dirty optional
- ✅ sync-failure-classify.ts: `fk_constraint` kind (error, non-transient, unthrottled)
- ✅ engine.svelte.ts: `db_metadata.synced_seq` cursor; self-heal at 2nd consecutive fk_constraint
     (`#self_heal` → full resync); prune runs on EVERY null-cursor sync (self-heal + transition +
     initial); skipped-orphan warn log; `sync_self_healed` telemetry
- ✅ dict-sync-engine.ts: synced_seq cursor; `flush_push_only()`; `on_integrity_wedged` at 2nd
     consecutive fk_constraint (fires before breaker halts at 3)
- ✅ dict-instance.ts: `rebuild()` (flush-push-only → reset; aborts on flush failure so local work
     is never lost); boot-time seq-transition detection (`synced_seq` missing + `last_modified_at`
     present); `report_dict_self_healed` telemetry
- ✅ /admin/sync page: cursor shown as `#seq` + "Last successful sync" column (stories updated,
     svelte-look verified light+dark)
- ✅ Tests (430 db-suite, 1453 total, all pass): server-seq.test.ts (trigger proof incl. FK-action
     firing from INSIDE the cascade trigger — verified empirically first), stale-stamp delivery
     regression, admin self-heal + prune + dirty-preservation (engine-convergence), dict
     on_integrity_wedged, admin orphan-skip, snapshot pruned_up_to_seq + baked synced_seq
- ✅ tsc / lint / check clean
- ✅ Browser e2e (headless, dev server): admin login → /admin/sync full pull → seq cursor `#9` →
     clean no-op resync; achi dict fresh snapshot boot (485 entries, /db baked cursor); the
     one-time TRANSITION path (doctored old-cursor OPFS file → "rebuilding from a fresh snapshot
     (seq_cursor_transition)" → fresh baked cursor). NOTE for future e2e: the sqlite proxy's exec
     triggers a post-write sync that instantly re-writes synced_seq — block `/changes` via request
     interception while doctoring metadata.
- ✅ .knowledge/migration/dict-sync-invariants.md + database skill updated

## Deploy notes (NOT yet deployed — Jacob to say when)
1. Push to main → VPS deploy. Server shared.db migrates at boot; dict dbs migrate lazily on first
   open. Old bundles get 409 → reload → clients migrate + transition (admin full pull+prune; dict
   snapshot rebuild).
2. ONE-TIME after deploy: force-refresh all R2 snapshots so viewers boot with baked cursors
   instead of falling back to cursor-null full pulls over /changes:
   `UPDATE dictionaries SET snapshot_uploaded_at = NULL` on prod shared.db → builder rebuilds all
   on its next sweeps (opening each db also applies its migration).
3. Verify wedged users recover: query logs.db for `sync_self_healed` rows (Diego b083633c admin;
   2ee3d8f3 + 259acd88 on sugtstun) and confirm no new `FOREIGN KEY` sync_failed rows.

## Follow-ups (separate tasks)
- house + tutor have the same LWW-timestamp pull hole → spawn parity sessions.
- Optional: dict-engine prune on cursor-null full pulls (admin engine has it; dict path only
  reachable via MemoryVFS boots + stale-snapshot transition window).
- Optional: auto-tombstone cascaded children via AFTER DELETE triggers (ghost-child cleanup
  currently handled by the self-heal rebuild).

## Prod facts for later verification
- Diego b083633c wedged (admin); users 2ee3d8f3 + 259acd88 wedged on sugtstun (dict).
- After deploy: their next visit should self-heal; check client_logs for `sync_self_healed`
  and absence of new FK `sync_failed` rows.
