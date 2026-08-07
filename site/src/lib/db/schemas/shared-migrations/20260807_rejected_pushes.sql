------------------------------------------------------------------
-- rejected_pushes — the DEVICE-SIDE QUARANTINE for refused writes, admin
-- shared.db half. Same table, same reasons, same incident as the dictionary
-- migration of the same name — read that one for the full story.
--
-- In short: the refused-write contract tells an author their push was refused,
-- but the delete-echo in the same response removes the only copy of the work.
-- The sync engine now writes the pushed PAYLOAD here first, inside the apply
-- transaction, so the text survives on the device.
--
-- These shared migrations run on BOTH the server and every admin client. On the
-- client this is the live quarantine. On the server the table is created and
-- currently unused — the durable server-side ledger (house's second half) is
-- deliberately deferred, and this leaves the shape ready for it without a
-- second migration later.
--
-- Server-only-style bookkeeping: never synced (absent from the syncable set).
-- Ported from house `4d9da404` (`20260805_rejected_pushes.sql`).
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
-- recurs on every round trip, and re-inserting would grow the table without
-- bound. The engine refreshes the unacknowledged row instead.
CREATE INDEX IF NOT EXISTS idx_rejected_pushes_unacked ON rejected_pushes (table_name, row_id) WHERE acknowledged_at IS NULL;
