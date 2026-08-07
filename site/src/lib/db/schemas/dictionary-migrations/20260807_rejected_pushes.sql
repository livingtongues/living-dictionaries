------------------------------------------------------------------
-- rejected_pushes — the DEVICE-SIDE QUARANTINE for refused writes.
--
-- THE INCIDENT. On 2026-08-04 an editor spent an evening writing into a
-- document the server had already deleted. Every layer reported success; the
-- work was discarded. The refused-write contract (2026-08-05, `rejected_rows`
-- on the sync wire) fixed the SILENCE — the server now declares each refused
-- row with a reason and the author is told. It did not fix the LOSS.
--
-- Because the composition is brutal: the server refuses the row AND echoes a
-- delete for it, so the apply transaction removes the only copy that existed.
-- The author is handed an id and a reason with no text attached. house shipped
-- both halves; LD (and tutor) shipped only the announcement — proved by
-- execution in the 2026-08-06 cross-repo review (fan-out ledger row 1).
--
-- So: before the delete-echo / full-resync prune converges the mirror, the sync
-- engine writes the PUSHED PAYLOAD here, inside the same transaction. The row
-- the author typed still exists on the device they are standing at, even though
-- the live row is about to be removed.
--
-- NEVER SYNCED (absent from DICT_SYNCABLE_TABLES) and deliberately WITHOUT the
-- `dirty` / `server_seq` columns + triggers every syncable table carries — this
-- is local bookkeeping, and a bump of the sync cursor on every refusal would
-- make a refusal look like dictionary content changing.
--
-- Ported from house `4d9da404` (`20260805_rejected_pushes.sql`). The durable
-- SERVER-side ledger is the second half and is deliberately deferred.
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rejected_pushes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  user_id TEXT,
  payload TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  acknowledged_at TEXT
);

-- One live quarantine row per refused (table, row): a refusal nothing clears
-- recurs on every 30-second round trip, and re-inserting would grow the table
-- without bound. The engine refreshes the unacknowledged row instead.
CREATE INDEX IF NOT EXISTS idx_rejected_pushes_unacked ON rejected_pushes (table_name, row_id) WHERE acknowledged_at IS NULL;
