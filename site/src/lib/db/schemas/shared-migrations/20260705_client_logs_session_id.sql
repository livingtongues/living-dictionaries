-- Promote context.session_id to a REAL column on client_logs so analytics can
-- filter/group on it directly instead of a per-row json_extract (the bulk of the
-- old multi-second analytics compute). Backfill existing rows from context.
--
-- On the server this runs (in open_shared_db) BEFORE the boot-time split moves
-- client_logs into logs.db, so the split copies a populated session_id. On admin
-- wa-sqlite clients client_logs stays empty, so the backfill is a no-op. The
-- logs.db + logs-archive.db copies carry session_id via their own DDL.
ALTER TABLE client_logs ADD COLUMN session_id TEXT;

UPDATE client_logs
  SET session_id = json_extract(context, '$.session_id')
  WHERE session_id IS NULL AND context IS NOT NULL AND context LIKE '%session_id%';

CREATE INDEX IF NOT EXISTS idx_client_logs_session_id ON client_logs(session_id);
