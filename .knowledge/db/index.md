# DB / sync / deploy knowledge

The living SQLite + local-first architecture docs (moved here from the retired `migration/`
category 2026-07-17 — these are CURRENT guidance, not history). The one-page historical record
of the Supabase→SQLite cutover itself is [../supabase-cutover.md](../supabase-cutover.md).

## Schema & migrations
- [adding-a-syncable-dict-table.md](./adding-a-syncable-dict-table.md) — the checklist for a new
  per-dict syncable table (migration, drizzle, DICT_SYNCABLE_TABLES, version bump, client bundle).
- [dropping-a-syncable-column.md](./dropping-a-syncable-column.md) — the safe column-removal recipe.
- [migration-squash-2026-07-02.md](./migration-squash-2026-07-02.md) — the consolidated-initial
  baseline and what "pre-squash DB" compat sections mean.

## Sync engines & local-first runtime
- [dict-sync-invariants.md](./dict-sync-invariants.md) — the invariants that keep bidirectional
  sync convergent (dirty-clearing, upserts, fast-bail, sector deletes).
- [m4-write-sync.md](./m4-write-sync.md) — per-dict write/sync deep-dive.
- [m4-sqlite-read-layer.md](./m4-sqlite-read-layer.md) — read path: snapshot bundle → Orama →
  EntryData.
- [opfs-leader-worker-dict-db.md](./opfs-leader-worker-dict-db.md) — the leader-elected OPFS
  worker model (why, locks, BroadcastChannel RPC).
- [leader-worker-boot-robustness.md](./leader-worker-boot-robustness.md) — boot failure modes +
  retries.
- [client-behind-recovery.md](./client-behind-recovery.md) — schema-version mismatch recovery.
- [server-side-content-cleanup-sync.md](./server-side-content-cleanup-sync.md) — how server-side
  deletes/cleanups propagate to clients.

## Media & deploy
- [media-upload.md](./media-upload.md) — GCS presigned upload flow + serving URLs.
- [build-and-deploy-gotchas.md](./build-and-deploy-gotchas.md) — build/deploy + lockfile
  discipline (native deps in `dependencies`, preflight env grep, blue/green).
