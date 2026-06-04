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

LD also doesn't have house's junction-replace tombstone hazard: junction unlink is a **soft-delete**
(`deleted` column via `unlink_junction`), synced as an ordinary dirty row, not a `deletes` tombstone.

**Invariant to preserve:** never let an editor write before `entries_data.loading` is false / before the
cold-open `sync_now`. If a future write path bypasses `get_pieces`, re-add the gate.

## 2. `created_by`/`updated_by` FKs — N/A: dict.db has no `users` table (house bug: FK fails on fresh DB)
House `documents/images/videos` carry `created_by_user_id` FKs → local `users(id)`, so a fresh DB needs
an `INSERT OR IGNORE` of the editor's own users row first.

LD's **per-dict** `dictionaries/{id}.db` has **no `users` table and no FK** on these columns —
`created_by_user_id`/`updated_by_user_id` are plain `TEXT NOT NULL` (see
`dictionary-migrations/20260525_initial.sql`). Users live in the separate `shared.db`. operations.ts
always stamps both from the auth user id, satisfying NOT NULL. So there's nothing to seed locally.

**Invariant to preserve:** if a future dict migration ever adds a `users` table + FK to dict.db, port
house's "ensure local users row" step into the layout's cold-open path.

## 3. Sector-scoped `deletes` — N/A: the dict engine is single-sector (house bug: cross-sector tombstone wipe)
House's `engine.svelte.ts` must collect+clear `deletes` SCOPED to the current sector's tables; an
unscoped `DELETE FROM deletes` lets the first-synced writable sector wipe another's pending tombstones
(latent until ≥2 writable sectors).

LD's `dict-client/dict-sync-engine.ts` is **single-sector by design** (one dict.db, one
`db_metadata.last_modified_at` watermark — the file comment says so). Its `DELETE FROM deletes` after a
successful push is therefore safe: there is no second writable sector sharing that `deletes` table.
Moreover LD currently **doesn't use the `deletes` table at all** for content — operations.ts soft-deletes
via the `deleted` column (`dict_db.X.update({deleted})`), never `dict_db.X.delete()` (which is the only
thing that writes `deletes`).

**Invariant to preserve:** the per-dict engine stays single-sector. If LD ever shares one dict.db across
multiple independently-synced writable scopes, scope the `DELETE FROM deletes` to the sector's tables
(copy house's `#sync_sector`) before adding the second scope.
