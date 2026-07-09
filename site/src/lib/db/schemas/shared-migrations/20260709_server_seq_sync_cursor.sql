-- server_seq: server-assigned monotonic sync cursor (root fix for the FK-wedge
-- sync hole — see .issues/sync-fk-wedge-server-seq-and-self-heal.md).
--
-- WHY: pulls used to filter `WHERE updated_at > cursor`, but merged rows keep the
-- CLIENT-supplied updated_at (the LWW arbiter). A row pushed with a stamp older
-- than another client's cursor was invisible to that client FOREVER; when a child
-- of that row later rode down, the client's deferred-FK check failed at COMMIT and
-- every subsequent sync rolled back (permanent wedge). `server_seq` is assigned by
-- triggers from a strictly monotonic per-DB counter on EVERY insert/update — pulls
-- filter on it instead, so nothing can land below a client's watermark.
--
-- These triggers run on the server AND on every client DB (same migration files).
-- Client-side assignments are meaningless-but-harmless: the server strips
-- `server_seq` from pushed rows and reassigns via its own triggers, and clients
-- track their cursor from the response (`db_metadata.synced_seq`), never from
-- their local counter.
--
-- VERIFIED (see server-seq test): FK actions (ON DELETE CASCADE / SET NULL) fire
-- these triggers regardless of recursive_triggers, so cascade-touched rows get a
-- fresh seq and ride the next pull. recursive_triggers is OFF (default) in
-- better-sqlite3 + wa-sqlite, so the self-UPDATE inside each trigger cannot
-- recurse; the WHEN guard on the update trigger is belt-and-braces.

CREATE TABLE IF NOT EXISTS server_seq_counter (
  seq INTEGER NOT NULL
);
INSERT INTO server_seq_counter (seq)
  SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM server_seq_counter);


------------------------------------------------------------------
-- users
------------------------------------------------------------------
ALTER TABLE users ADD COLUMN server_seq INTEGER;
UPDATE users SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_users_server_seq ON users(server_seq);

DROP TRIGGER IF EXISTS users_server_seq_ai;
CREATE TRIGGER users_server_seq_ai AFTER INSERT ON users
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE users SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS users_server_seq_au;
CREATE TRIGGER users_server_seq_au AFTER UPDATE ON users
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE users SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- dictionaries
------------------------------------------------------------------
ALTER TABLE dictionaries ADD COLUMN server_seq INTEGER;
UPDATE dictionaries SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_dictionaries_server_seq ON dictionaries(server_seq);

DROP TRIGGER IF EXISTS dictionaries_server_seq_ai;
CREATE TRIGGER dictionaries_server_seq_ai AFTER INSERT ON dictionaries
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionaries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS dictionaries_server_seq_au;
CREATE TRIGGER dictionaries_server_seq_au AFTER UPDATE ON dictionaries
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionaries SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- dictionary_roles
------------------------------------------------------------------
ALTER TABLE dictionary_roles ADD COLUMN server_seq INTEGER;
UPDATE dictionary_roles SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_dictionary_roles_server_seq ON dictionary_roles(server_seq);

DROP TRIGGER IF EXISTS dictionary_roles_server_seq_ai;
CREATE TRIGGER dictionary_roles_server_seq_ai AFTER INSERT ON dictionary_roles
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionary_roles SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS dictionary_roles_server_seq_au;
CREATE TRIGGER dictionary_roles_server_seq_au AFTER UPDATE ON dictionary_roles
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionary_roles SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- dictionary_partners
------------------------------------------------------------------
ALTER TABLE dictionary_partners ADD COLUMN server_seq INTEGER;
UPDATE dictionary_partners SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_dictionary_partners_server_seq ON dictionary_partners(server_seq);

DROP TRIGGER IF EXISTS dictionary_partners_server_seq_ai;
CREATE TRIGGER dictionary_partners_server_seq_ai AFTER INSERT ON dictionary_partners
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionary_partners SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS dictionary_partners_server_seq_au;
CREATE TRIGGER dictionary_partners_server_seq_au AFTER UPDATE ON dictionary_partners
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE dictionary_partners SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- invites
------------------------------------------------------------------
ALTER TABLE invites ADD COLUMN server_seq INTEGER;
UPDATE invites SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_invites_server_seq ON invites(server_seq);

DROP TRIGGER IF EXISTS invites_server_seq_ai;
CREATE TRIGGER invites_server_seq_ai AFTER INSERT ON invites
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE invites SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS invites_server_seq_au;
CREATE TRIGGER invites_server_seq_au AFTER UPDATE ON invites
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE invites SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- message_threads
------------------------------------------------------------------
ALTER TABLE message_threads ADD COLUMN server_seq INTEGER;
UPDATE message_threads SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_message_threads_server_seq ON message_threads(server_seq);

DROP TRIGGER IF EXISTS message_threads_server_seq_ai;
CREATE TRIGGER message_threads_server_seq_ai AFTER INSERT ON message_threads
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE message_threads SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS message_threads_server_seq_au;
CREATE TRIGGER message_threads_server_seq_au AFTER UPDATE ON message_threads
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE message_threads SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- messages
------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN server_seq INTEGER;
UPDATE messages SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_messages_server_seq ON messages(server_seq);

DROP TRIGGER IF EXISTS messages_server_seq_ai;
CREATE TRIGGER messages_server_seq_ai AFTER INSERT ON messages
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE messages SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS messages_server_seq_au;
CREATE TRIGGER messages_server_seq_au AFTER UPDATE ON messages
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE messages SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- message_attachments
------------------------------------------------------------------
ALTER TABLE message_attachments ADD COLUMN server_seq INTEGER;
UPDATE message_attachments SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_message_attachments_server_seq ON message_attachments(server_seq);

DROP TRIGGER IF EXISTS message_attachments_server_seq_ai;
CREATE TRIGGER message_attachments_server_seq_ai AFTER INSERT ON message_attachments
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE message_attachments SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS message_attachments_server_seq_au;
CREATE TRIGGER message_attachments_server_seq_au AFTER UPDATE ON message_attachments
WHEN NEW.server_seq IS OLD.server_seq
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE message_attachments SET server_seq = (SELECT seq FROM server_seq_counter) WHERE id = NEW.id;
END;

------------------------------------------------------------------
-- deletes (tombstones need a seq too — the tombstone pull rides the same cursor)
------------------------------------------------------------------
ALTER TABLE deletes ADD COLUMN server_seq INTEGER;
UPDATE deletes SET server_seq = rowid;
CREATE INDEX IF NOT EXISTS idx_deletes_server_seq ON deletes(server_seq);

DROP TRIGGER IF EXISTS deletes_server_seq_ai;
CREATE TRIGGER deletes_server_seq_ai AFTER INSERT ON deletes
BEGIN
  UPDATE server_seq_counter SET seq = seq + 1;
  UPDATE deletes SET server_seq = (SELECT seq FROM server_seq_counter)
    WHERE table_name = NEW.table_name AND id = NEW.id;
END;

-- Initialize the counter above every backfilled seq so fresh assignments are
-- strictly greater than anything pre-existing.
UPDATE server_seq_counter SET seq = (
  SELECT MAX(m) FROM (
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM users UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM dictionaries UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM dictionary_roles UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM dictionary_partners UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM invites UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM message_threads UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM messages UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM message_attachments UNION ALL
    SELECT COALESCE(MAX(server_seq), 0) AS m FROM deletes
  )
);