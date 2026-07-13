# dict client migration idempotency — `duplicate column name: server_seq` boot loop

Spotted during the 2026-07-13 tutelo investigation (separate bug, not fixed there).

One `äynu` session logged `leader_boot_failed` at `last_stage: 'migrate'` with
`duplicate column name: server_seq` **226×** (repeat_count). Mechanism (hypothesis):

- `dict-instance.ts` `ensure_migrations` runs each migration as `exec_raw(sql)` THEN a separate
  `INSERT INTO migrations` — not atomic.
- The OPFS connection uses `journal_mode = MEMORY`, so a worker killed mid-migration leaves
  **partially-applied DDL persisted** with no migrations row.
- Next boot re-runs the file → `ALTER TABLE … ADD COLUMN server_seq` (not idempotent) → boot fails.
- `open_opfs_prepared`'s self-heal (delete + refetch snapshot) SHOULD recover on attempt 2 — why
  one session repeated 226× is unexplained (snapshot refetch failing? secure/404 dict? worker
  respawn before the delete?).

Ideas:
- Make `ensure_migrations` detect "duplicate column name" for a known migration and mark it
  applied (heals the half-applied state without data loss), or
- probe `PRAGMA table_info` before each ALTER, or
- wrap migration + bookkeeping in a transaction (wa-sqlite exec can't BEGIN inside multi-statement
  exec — would need per-statement splitting).

Check logs for recurrence:
`SELECT ... FROM client_logs WHERE message='leader_boot_failed' AND context LIKE '%duplicate column%'`
