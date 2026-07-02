# Port house's local-DB corruption self-heal (boot quick_check + blocking reset modal)

2026-07-02: LD got sync-failure **telemetry** (`sync_failed` rows via
`$lib/db/sync/report-sync-failure.ts` for the main-thread admin engine and
`$lib/db/dict-client/report-dict-sync-failure.ts` for the worker dict engine —
classification in `$lib/db/sync/sync-failure-classify.ts`), but NOT house's corruption
**recovery** UX. When a "database disk image is malformed" cluster shows up in LD's
`client_logs`, port the rest from house
(`house/.issues/sync-error-logging-and-corruption-self-heal.md`):

- `PRAGMA quick_check` on non-fresh OPFS open; corrupt + zero readable dirty rows →
  silent delete + resync/snapshot-redownload; corrupt + dirty rows → boot blocked
  (house: `decide_boot_corruption` in `$lib/db/sync/corruption.ts`,
  `check_boot_corruption` in `client/admin-instance.ts`).
- Corruption latch on the sync engines (`blocked_by_corruption` in the state snapshot,
  auto-sync stops, writes refused) + `mark_corrupted` RPC so a main-thread live-query
  corruption raises it worker-side.
- Blocking confirm-reset overlay (house: `client/CorruptionBlockModal.svelte` +
  `corruption-block.svelte.ts` one-way latch store, root-layout mounted) showing the
  unsynced-dirty-row count; ships `local_db_corrupt` (stage/action/dirty_count).

LD nuance: the dict DB can also recover by re-downloading the snapshot (like house's
viewer path) — for read-only users prefer silent snapshot re-download over a modal;
the modal is only needed when unsynced editor writes would be lost.
