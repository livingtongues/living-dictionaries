# Cross-tab: a tab's Orama search index misses ANOTHER tab's local delete until reload

**Status:** ✅ FIXED (2026-06-06, Option A). Discovered while implementing dict hard-delete tombstones
(`.issues/dict-tombstone-path-incomplete.md`).

## Done
- `rpc-types.ts` `ExecRequest`: added optional `deleted_rows?: { table_name, id }[]`.
- `dict-connection.ts` `execute(...)`: 3rd options arg now also accepts `deleted_rows`, forwarded on
  the exec envelope.
- `shared-worker.ts` `handle_exec`: after the exec, broadcasts `rows_deleted` (excluding the
  originator port) when `message.deleted_rows?.length` — mirrors the existing `tables_changed` rule.
- `dict-live-db.svelte.ts` `#delete`: passes `deleted_rows: [{ table_name, id }]`; keeps the in-process
  `#notify_deletes` for the originating tab.
- Test: `e2e/dict-delete-2tab.mjs` (`pnpm -F site test:delete-2tab`) — ONE context / TWO tabs (shared
  SharedWorker); tab A deletes entry `e_ja`, tab B's `/achi/entries` list drops it (13→12) within 8s
  WITHOUT reload or sync_now (proves the broadcast path, not a pull).

---
_Original analysis (kept for reference):_

## Symptom
Two tabs (same browser) open the SAME dictionary. Tab A deletes an entry/sense/photo/etc.
- Tab A: search results + everything update correctly.
- Tab B: table-store views (entry detail, etc.) refresh correctly, BUT Tab B's **search/entries list**
  (the Orama index) still shows the deleted item until Tab B reloads.

Only affects **local** deletes from another tab. A delete that arrives via **sync pull** (i.e. from a
different device/server) propagates to ALL tabs correctly. Single-tab editing is always correct.

## Why (the mechanism)
The per-dict wa-sqlite DB is shared (one SharedWorker, one OPFS file). But the **Orama search index is
a per-tab, in-memory derived structure** (each tab runs its own `entry.worker.ts`). Each tab's
`orama-watcher` keeps its index fresh two ways:
1. **Upserts** — table-change notifications trigger a delta scan `WHERE updated_at > watermark`. This
   works cross-tab: a changed row still EXISTS with a bumped `updated_at`, so any tab's scan finds it.
2. **Deletes** — a hard-deleted row VANISHES from that scan, so deletes must be delivered as explicit
   `{table_name, id}` events, out-of-band.

Delete events reach a tab's watcher via `dict_db.subscribe_deletes(...)`. There are two emitters, and
only ONE of them is cross-tab:

| Delete source | How the event is emitted | Reaches other tabs? |
|---|---|---|
| **Sync pull** (server → client) | `dict-sync-engine.#apply_response` → `on_rows_deleted` → SharedWorker `broadcast_to_dict({type:'rows_deleted'})` → every tab's `DictLiveDb` → `#notify_deletes` | ✅ yes (broadcast) |
| **Local delete** (`DictLiveDb.#delete`) | in-process `this.#notify_deletes([...])` — a direct callback in the SAME tab | ❌ no (never broadcast) |

So a local delete updates only the originating tab's index. Other tabs get a `tables_changed`
broadcast (which refreshes their table STORES — correct) but **no `rows_deleted`**, so their Orama
index is never told the row is gone.

Why it's built this way: `#delete` runs on the main thread; the SharedWorker just executes the opaque
`INSERT INTO deletes` SQL and doesn't know "this means remove entry X from search." The sync-pull path
already runs inside the worker, so it had a natural place to emit the broadcast; the local path didn't.

Relevant code: `handle_exec` in `dict-client/shared-worker.ts` (line ~289) already broadcasts
`tables_changed` for an exec's `affected_tables` with `exclude_port: context.port` (originator skipped,
since it updated in-process). The fix mirrors that for deletes.

## The fix (recommended: Option A — broadcast local delete events too)
Make the local-delete path emit a `rows_deleted` broadcast to OTHER tabs, symmetric with the sync-pull
path. Carry the delete ids explicitly on the `exec` message so the worker needn't parse SQL.

- [ ] `rpc-types.ts`: add optional `deleted_rows?: { table_name: string, id: string }[]` to the `exec`
      request message.
- [ ] `dict-connection.ts` `execute(...)`: accept `deleted_rows` in its options object and pass it on
      the exec envelope (alongside the existing `affected_tables`).
- [ ] `shared-worker.ts` `handle_exec`: after running the exec, if `message.deleted_rows?.length`,
      `broadcast_to_dict({ dict_id, message: { type: 'rows_deleted', dict_id, deletes: message.deleted_rows }, exclude_port: context.port })`.
      (Exclude the originator — it already ran `#notify_deletes` in-process.)
- [ ] `dict-live-db.svelte.ts` `#delete`: pass `deleted_rows: ids.map(id => ({ table_name, id }))` in the
      `execute` options. KEEP the in-process `#notify_deletes` for the originating tab.

Net effect: every delete (local or pulled) ends in a `rows_deleted` broadcast to other tabs + an
in-tab notify for the originator. `apply_rows`'s delete handling is already idempotent, so a stray
double-notify is harmless.

Effort: small (~4 files, additive, no sync-engine drain changes). Risk: low.

### Options considered + rejected
- **B. Watcher scans the `deletes` table (per-tab, shared DB).** Rejected: the client `deletes` table
  is drained after push (race vs the 40ms watcher) AND sync-pulled deletes don't write to it — would
  need a durable `pushed`-flagged log + rowid watermark + sync-engine drain changes. Much more invasive.
- **C. Do nothing.** Current state. Fine for pre-prod / single-tab; reload fixes it.

## Test idea
Vitest is awkward for true multi-tab. Either (a) unit-test that `#delete` puts `deleted_rows` on the
exec envelope + `handle_exec` broadcasts `rows_deleted` (excluding originator), or (b) a Playwright
two-context test: open same dict in two tabs, delete in A, assert B's search list drops the entry
without reload.

## Touch points
- `src/lib/db/dict-client/rpc-types.ts` (exec message + `RowsDeletedBroadcast` already exists)
- `src/lib/db/dict-client/dict-connection.ts` (`execute` options)
- `src/lib/db/dict-client/shared-worker.ts` (`handle_exec`, `broadcast_to_dict`)
- `src/lib/db/dict-client/dict-live-db.svelte.ts` (`#delete`, `#notify_deletes`, broadcast handler)
- `src/lib/search/orama-watcher.ts` (already consumes `subscribe_deletes` — no change)
