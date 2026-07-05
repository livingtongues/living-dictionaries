# P1 — Fresh public viewers get an EMPTY dictionary (snapshot cursor 14 months behind live cursor)

Found by the 2026-07-04 (run 2, 22:40 UTC) log review. **Read-only review recommended this; NOT
yet fixed.** Actively breaking real fresh-visitor traffic (incl. Facebook/social shares) on ~2000
dictionaries. Needs Jacob's decision + a data mitigation.

## Symptom (in `client_logs`, 07-04)
A boot cascade on `/{dict}/entries` for **anonymous public visitors**, escalating hard vs 07-03:

| message | 07-03 | 07-04 | code |
|---|---|---|---|
| `initial dict sync failed` | 5 | **45** (40 sessions) | `{"code":"snapshot_expired"}` |
| `Failed to read dict bundle from wa-sqlite` | 3 | **23** (21 sessions) | `{"code":21}` (SQLITE_MISUSE) |
| `[orama-watcher] delta scan failed` | 3 | 5 | — |
| `leader_boot_failed` | 20 | 13 | — |

**Recovery is terrible: of 40 failed sessions, only 3 opened an entry and 4 searched afterward** —
~90% of these visitors saw an empty dictionary. All are `opfs-worker` tier, spread across
Android / iOS Safari / Facebook-in-app / desktop (NOT a browser-capability issue). Hit dozens of
distinct dicts (apatani, sibe, daan-davi, mahasuvi, mazahua, ndebele, tuscarora, badaga, opata,
ese-ejja, brezhoneg, ndau, muthuvan …), many arriving via `fbclid` social links.

## Root cause (confirmed on the VPS)
The untracked **`.issues/star-dict-featured-entries/insert-editor-star-sweep.mjs`** featured-entries
starring sweep wrote `featured_entries` rows into **every** dict.db at **2026-07-04T11:23:08 UTC**.
Each write bumped that dict's `db_metadata.last_modified_at` (the sync cursor) to `2026-07-04T11:23`
via the lmod trigger. But the **R2 snapshots were rebuilt at 10:40–11:14, BEFORE the 11:23 sweep**,
so every snapshot still embeds the dict's *true content* cursor.

Confirmed on `apatani.db`:
- `db_metadata.last_modified_at` = **2026-07-04T11:23:08** (live server cursor)
- newest real content row (`entries`/`senses`) = **2025-05-13** — 14 months older
- `featured_entries`: 6 rows, all `updated_at = 2026-07-04T11:23:08`
- `snapshot_uploaded_at` (catalog) = **10:40:44** (before the sweep)

The client derives `synced_up_to` from the snapshot's `db_metadata.last_modified_at`
(`dict-sync-engine.ts#build_request` → `#read_metadata('last_modified_at')`). So a fresh viewer of
any dictionary **not content-edited in the last 60 days** now sends `synced_up_to ≈ 2024/2025`, the
server reads live `last_modified_at = 2026-07-04`, and the gap trips the 60-day guard in
`site/src/routes/api/dictionary/[id]/changes/+server.ts:82-86`
(`SNAPSHOT_EXPIRED_DAYS = 60`) → **410 `snapshot_expired`**.

### Why it isn't self-healing
1. `snapshot_expired` → `dict-instance.ts` `translate_sync_error` → `maybe_auto_reset()` → `reset()`
   closes the OPFS connection, deletes + refetches the snapshot, re-syncs. But the refetched snapshot
   carries the **same** old cursor → `snapshot_expired` again (now `auto_reset_attempted=true`, so no
   loop — but also no fix). The data is present in the snapshot; sync just refuses to advance.
2. **The race that empties the list:** `reset()` closes the connection while the entries page's
   `read_dict_bundle` query is in flight (`entries-ui-store.ts:82`) → the query fails with
   `SQLITE_MISUSE (code 21)` → the `.catch` calls `set_loading(false)` **with no data set and no
   retry** (`entries-ui-store.ts:119-122`) → the user sees an empty entry list even though the
   snapshot holds all 4157 entries.
3. **The builder won't re-close the gap.** The snapshot builder rebuilds when catalog
   `updated_at > snapshot_uploaded_at`. The sweep bumped dict.db `last_modified_at` but NOT catalog
   `updated_at` (still 10:11 for these dicts, < snapshot_uploaded_at 10:40). So the builder considers
   every affected dict fresh and **will never rebuild** — the mismatch is permanent until something
   bumps catalog `updated_at` past `snapshot_uploaded_at`.

## Fix options (decide)
**Immediate mitigation (data, unblocks users now):** force a snapshot rebuild for every dict so the
snapshot cursor catches up to the live `last_modified_at` — e.g. bump catalog `dictionaries.updated_at
= now()` for all dicts (> `snapshot_uploaded_at`), or invoke the builder directly. Verify the cascade
stops (`initial dict sync failed` count drops to ~0 on the next window).

**Durable fixes (pick, ideally more than one — defense in depth):**
1. **Don't advance the sync cursor without rebuilding the snapshot.** Any bulk/admin write that bumps
   `last_modified_at` (featured sweep, future migrations) must also bump catalog `updated_at` so the
   builder re-snapshots. Consider making `insert-editor-star-sweep.mjs` (and similar tools) touch
   catalog `updated_at`.
2. **Make `read_dict_bundle` resilient to the reset race** — retry once on `SQLITE_MISUSE`/closed
   connection instead of `set_loading(false)` with no data; the snapshot data is valid and present.
   This alone would have turned today's empty lists into successful renders.
3. **Reconsider the `snapshot_expired` guard** so a freshly-issued snapshot can't immediately be
   declared expired (e.g. compare against the snapshot build time, or don't 410 a viewer with zero
   dirty rows — just serve `since=null` / a fresh pull instead of forcing reset).

## Verification queries (VPS, read-only — see check-logs skill)
- Cascade trend: `client_logs` `message IN ('initial dict sync failed','Failed to read dict bundle
  from wa-sqlite')` grouped by day.
- Per-dict proof: open `/data/dictionaries/<id>.db` → compare `db_metadata.last_modified_at` vs
  `MAX(updated_at)` in `entries`; `featured_entries` rows all stamped `2026-07-04T11:23`.
- Recovery: for sessions with `initial dict sync failed`, count those that later logged `entry_opened`.
