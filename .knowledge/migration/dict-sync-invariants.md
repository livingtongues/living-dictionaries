# Dict-sync invariants — why house's three local-first bugs don't bite LD (LD-P4B audit)

House (the sibling app sharing the learn-from-derived sync engine) hit three load-bearing local-first
editing bugs (`house .knowledge/architecture/{local-first-library-editing.md, sync-deletes.md}`). This
page records the audit of LD's per-dict engine against each — **all three are already prevented by LD's
architecture**, so no LD code changed. Keep these invariants true when evolving the write path.

## 1. Writes never run against an un-synced DB — already enforced (house bug: cold-DB id collisions)
House requires `await sync.ensure_initial_sync()` before the first write, or a cold local DB mints
lookup ids that collide with the server's `UNIQUE(name)` and skips junction tombstones.

LD gets the same guarantee two ways, so there's no explicit `ensure_initial_sync` call:
- **`[dictionaryId]/+layout.ts`** opens the dict on cold cache-miss and `await conn.sync_now()` BEFORE
  creating `dict_db` (the OPFS snapshot bootstrap has already populated the file; MemoryVFS backfills
  via sync-from-null). So the local DB mirrors the server before `dict_db` exists.
- **`operations.ts get_pieces()`** hard-gates every write on `entries_data.loading === false`. `loading`
  only flips false at the END of `init_entries`, which runs after `read_dict_bundle` (after the layout's
  sync). So the editor literally cannot fire a write until the full dict is loaded.

Junction unlink is a **hard-delete tombstone** (`unlink_junction` → `dict_db.X.delete(id)` →
`INSERT INTO deletes`); the engine drains `deletes` by pushed `(table_name, id)`, never blanket, so
it has no house-style junction-tombstone-wipe hazard (see §3).

**Invariant to preserve:** never let an editor write before `entries_data.loading` is false / before the
cold-open `sync_now`. If a future write path bypasses `get_pieces`, re-add the gate.

## 2. `created_by`/`updated_by` FKs — N/A: dict.db has no `users` table (house bug: FK fails on fresh DB)
House `documents/images/videos` carry `created_by_user_id` FKs → local `users(id)`, so a fresh DB needs
an `INSERT OR IGNORE` of the editor's own users row first.

LD's **per-dict** `dictionaries/{id}.db` has **no `users` table and no FK** on these columns —
`created_by_user_id`/`updated_by_user_id` are plain `TEXT NOT NULL` (see
`dictionary-migrations/20260606_initial.sql`). Users live in the separate `shared.db`. operations.ts
always stamps both from the auth user id, satisfying NOT NULL. So there's nothing to seed locally.

**Invariant to preserve:** if a future dict migration ever adds a `users` table + FK to dict.db, port
house's "ensure local users row" step into the layout's cold-open path.

## 3. Sector-scoped `deletes` — N/A: the dict engine is single-sector (house bug: cross-sector tombstone wipe)
House's `engine.svelte.ts` must collect+clear `deletes` SCOPED to the current sector's tables; an
unscoped `DELETE FROM deletes` lets the first-synced writable sector wipe another's pending tombstones
(latent until ≥2 writable sectors).

LD's `dict-client/dict-sync-engine.ts` is **single-sector by design** (one dict.db, one
`db_metadata.last_modified_at` watermark — the file comment says so). Its drain after a successful push
clears `deletes` by pushed `(table_name, id)` — NOT a blanket `DELETE FROM deletes` — so a tombstone
queued mid-flight survives, and there's no second writable sector to wipe.

**Dict deletion is HARD-delete via the `deletes` tombstone (2026-06, was soft-delete).** Full model:
- **Client write** (`DictLiveDb.#delete`, `operations.ts unlink_junction`/`delete_*`): `INSERT INTO
  deletes(table_name,id)`. The `process_delete_cascade` trigger DELETEs the row; FK `ON DELETE CASCADE`
  sweeps children. The tombstone row persists as the push queue.
- **Server** (`process_dict_changes`): `INSERT OR REPLACE INTO deletes` fires the SAME hard-delete
  trigger → server row gone. PULL forwards a tombstone only `if (!exists)` (skips re-created ids).
- **Snapshot** (`r2-snapshot-builder.ts`): `DELETE FROM deletes` on the `.backup()` before gzip — else a
  fresh client re-pushes the server's whole tombstone log (its `deletes` table doubles as a push queue).
  Because the server already hard-deleted, the snapshot can't resurrect anything.
- **`last_modified_at` bump:** a DELETE fires no per-table bump trigger, so `process_delete_cascade`
  bumps the cursor itself (one line at the end of the trigger). Bump triggers use
  `INSERT … ON CONFLICT(key) DO UPDATE`, never `INSERT OR REPLACE` (the latter 500s when a trigger fires
  during the sync engine's outer UPSERT).
- **There is no `deleted` column** and no `WHERE deleted IS NULL` filtering anywhere — purged rows are
  simply absent.

**Search index (the non-obvious part):** hard-deleted rows vanish from the orama-watcher's
`updated_at > watermark` delta scan, so deletes are fed out-of-band. Local `#delete` emits
`#notify_deletes`; sync-pulled deletes emit a `rows_deleted` broadcast (engine `on_rows_deleted` →
SharedWorker → each tab). `orama-watcher` buffers them via `dict_db.subscribe_deletes` and passes to
`entry.worker apply_rows(changes, deletes)`, which reconstructs the removed row from its in-memory maps
(resolving the owning entry_id) to drop it from the index. KNOWN minor gap: a tab doesn't learn of
ANOTHER tab's *local* delete for its search index until reload (cross-tab table stores DO refresh;
sync-pulled deletes DO propagate).

**Invariants to preserve:**
- The per-dict engine stays single-sector; drain `deletes` by pushed `(table,id)`, never blanket.
- If you add a writable scope sharing one dict.db, scope the drain to that scope's tables.
- Keep the snapshot's `DELETE FROM deletes` and the server-side hard-delete trigger together: dropping
  either reintroduces the resurrection/re-push bug.

## 2026-07-09 — server_seq cursor (the FK-wedge root fix)

**Never pull by `updated_at` again.** LWW keeps the CLIENT-supplied `updated_at` on merge, so a
pushed row could land BELOW another client's cursor and stay invisible to it forever; when a child
of that row later rode down, the peer's deferred-FK check failed at apply-COMMIT and every sync
rolled back (2 admins + 3 sugtstun editors wedged in prod; issue
`sync-fk-wedge-server-seq-and-self-heal.md`). Both engines now pull `WHERE server_seq > cursor` —
a per-DB trigger-maintained monotonic counter (`server_seq_counter`), stamped on every
insert/update of every syncable table + `deletes`. `updated_at` is ONLY the LWW arbiter.

Non-obvious facts locked in by `server-seq.test.ts` and the migration comments:
- **FK actions fire triggers regardless of `recursive_triggers` and nesting** — a
  `DELETE … ON DELETE SET NULL` cascade initiated INSIDE `process_delete_cascade` still runs the
  seq-assignment trigger on the touched row (verified empirically; this is what keeps
  cascade-nulled rows visible to pulls).
- Server strips a pushed `server_seq` (like `dirty`) and reassigns — a client value could hide the
  row below peers' cursors.
- Client-side the same triggers run but their values are meaningless; the cursor comes ONLY from
  the response (`db_metadata.synced_seq`). Fresh snapshots carry a baked `synced_seq` (R2 builder +
  `/db` endpoint — the `/db` endpoint also now strips `deletes`, fixing an editor-bootstrap
  re-push storm).
- `snapshot_expired` is exact now: builder records `pruned_up_to_seq` before pruning tombstones;
  `/changes` 410s when `cursor < pruned_up_to_seq`.
- **Self-heal at 2 consecutive `fk_constraint` failures** (breaker still halts at 3): admin engine
  = full resync with prune (any null-cursor sync prunes non-dirty local rows absent from the
  response); dict instance = `rebuild()` (flush-push-only → snapshot reset; a failed sync already
  pushed its dirty rows — the failure is the LOCAL apply). Telemetry: `sync_self_healed`.
- One-time transition: old ISO cursors are ignored; admin clients full-pull+prune, dict OPFS files
  without `synced_seq` (but with `last_modified_at`) trigger the transition rebuild at boot.
- RESIDUAL (accepted): the dict engine's cursor-null full pull doesn't prune stale local rows
  (tombstones aren't sent for null cursors) — only reachable via MemoryVFS boots and the
  stale-snapshot transition window; the admin engine DOES prune.

**house + tutor have the same LWW-timestamp pull hole** — port this fix (spawn parity sessions).
