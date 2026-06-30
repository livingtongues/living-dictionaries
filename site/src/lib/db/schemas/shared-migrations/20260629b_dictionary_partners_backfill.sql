-- Backfill the `dictionary_partners` table on DBs provisioned BEFORE the
-- `20260525_initial.sql` migration was consolidated.
--
-- The production `shared.db` (and any DB provisioned from the pre-consolidation
-- migration set, which split `20260525_initial` + a since-deleted
-- `20260526_messages`) never received `dictionary_partners`: the table's
-- `CREATE` was folded into the rewritten initial migration AFTER that migration
-- was already recorded as applied, and migrations run once-per-name. Because
-- `dictionary_partners` is in SYNCABLE_TABLE_NAMES, every `/api/admin-sync` pull
-- reaching it threw `no such table: dictionary_partners` -> 500 (caught by the
-- 2026-06-29 log review; see `.issues/missing-dictionary-partners-table-prod.md`).
--
-- Everything here is idempotent (`IF NOT EXISTS` + DROP/CREATE the trigger), so
-- this is a no-op on healthy DBs that already have the consolidated schema.

CREATE TABLE IF NOT EXISTS dictionary_partners (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_storage_path TEXT,
  photo_serving_url TEXT,
  dirty INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_dictionary_partners_dict ON dictionary_partners(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_partners_updated_at ON dictionary_partners(updated_at);

-- Recreate the delete-cascade trigger to include the `dictionary_partners` arm.
-- A pre-consolidation DB created this trigger WITHOUT that arm (it couldn't
-- reference a table that didn't exist yet), so a `dictionary_partners` tombstone
-- would never cascade to the actual row. DROP + CREATE keeps the body in lockstep
-- with `20260525_initial.sql`; healthy DBs already match, so this is a no-op.
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER IF NOT EXISTS process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM message_attachments WHERE id = NEW.id      AND NEW.table_name = 'message_attachments';
  DELETE FROM messages            WHERE id = NEW.id      AND NEW.table_name = 'messages';
  DELETE FROM message_threads     WHERE id = NEW.id      AND NEW.table_name = 'message_threads';
  DELETE FROM dictionary_roles    WHERE id = NEW.id      AND NEW.table_name = 'dictionary_roles';
  DELETE FROM dictionary_partners WHERE id = NEW.id      AND NEW.table_name = 'dictionary_partners';
  DELETE FROM invites             WHERE id = NEW.id      AND NEW.table_name = 'invites';
  DELETE FROM dictionaries        WHERE id = NEW.id      AND NEW.table_name = 'dictionaries';
  DELETE FROM email_aliases       WHERE email = NEW.id   AND NEW.table_name = 'email_aliases';
  DELETE FROM users               WHERE id = NEW.id      AND NEW.table_name = 'users';
END;
