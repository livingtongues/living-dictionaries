-- Messages: support threads + individual messages + attachments.
-- Bidirectional sync to admin clients (same single sector as the rest of
-- LD's shared.db — Q-shared.3 in port-db-sync-architecture.md).
--
-- FK cascade chain on customer-delete:
--   users(deleted) → message_threads (CASCADE via from_user_id)
--                  → messages (CASCADE via thread_id)
--                  → message_attachments (CASCADE via message_id)

CREATE TABLE IF NOT EXISTS message_threads (
  id TEXT PRIMARY KEY,
  subject TEXT,
  source TEXT NOT NULL,                                 -- 'contact_form' | 'email'
  from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- nullable; resolved at write time, survives email changes
  from_email TEXT NOT NULL,                             -- snapshot of sender's email at write time
  from_name TEXT,                                       -- snapshot of sender's name at write time
  url TEXT,                                             -- contact-form context (page they were on)
  last_message_at TEXT NOT NULL,
  read_at TEXT,
  replied_at TEXT,
  replied_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  resolved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  dirty INTEGER,                                        -- sync engine: 1 when local writes need uploading
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Setting it could later trigger a ntfy ping on the assignee's personal topic
  -- (LD doesn't have admin ntfy_topic in $lib/admins.ts yet; columns prepared).
  assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT,
  assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- Which catch-all alias the customer emailed (support@, no-reply replies, etc.)
  -- so admins can see the context. Populated by the inbound endpoint
  -- (D4 `/api/messages/contact`) from the CF Worker payload.
  to_email TEXT
);
CREATE INDEX IF NOT EXISTS idx_message_threads_unresolved  ON message_threads(last_message_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_threads_from_user   ON message_threads(from_user_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_from_email  ON message_threads(from_email);
CREATE INDEX IF NOT EXISTS idx_message_threads_updated_at  ON message_threads(updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- nullable; resolved at write time
  author_kind TEXT NOT NULL, -- 'customer' | 'admin' | 'agent'
  body_text TEXT,
  body_html TEXT,
  -- RFC threading — populated by D4 `/api/messages/contact` (from the CF
  -- Worker payload) and by D4 `/api/messages/reply` (from SES on accepted
  -- send). NULL for contact-form-sourced threads with no underlying email.
  message_id TEXT,
  in_reply_to TEXT,
  email_references TEXT,
  raw_headers TEXT,
  dirty INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Outbound delivery state (only meaningful for admin/agent replies; NULL
  -- for inbound customer messages).
  --   delivery_status: 'pending' | 'sent' | 'failed' | NULL
  --   sent_at: ISO 8601 when SES accepted the send
  --   delivery_error: error message on 'failed'
  sent_at TEXT,
  delivery_status TEXT,
  delivery_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id    ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_message_id   ON messages(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_updated_at   ON messages(updated_at);

CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,           -- as supplied by the sender (or admin uploader)
  mimetype TEXT NOT NULL,           -- e.g. 'application/pdf', 'image/png'
  size_bytes INTEGER NOT NULL,
  content_id TEXT,                  -- for inline images (cid: refs in body_html)
  disposition TEXT NOT NULL,        -- 'attachment' | 'inline'
  storage_key TEXT NOT NULL,        -- R2 object key in livingdictionaries-attachments
  dirty INTEGER,                    -- always NULL on the client; column exists so sync engine WHERE dirty=1 doesn't fail
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message    ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_updated_at ON message_attachments(updated_at);

-- Replace process_delete_cascade trigger to include the message tables.
-- (DROP + CREATE — SQLite's CREATE TRIGGER IF NOT EXISTS would skip our updates.)
DROP TRIGGER IF EXISTS process_delete_cascade;
CREATE TRIGGER process_delete_cascade AFTER INSERT ON deletes
BEGIN
  DELETE FROM message_attachments WHERE id = NEW.id      AND NEW.table_name = 'message_attachments';
  DELETE FROM messages            WHERE id = NEW.id      AND NEW.table_name = 'messages';
  DELETE FROM message_threads     WHERE id = NEW.id      AND NEW.table_name = 'message_threads';
  DELETE FROM dictionary_roles    WHERE id = NEW.id      AND NEW.table_name = 'dictionary_roles';
  DELETE FROM invites             WHERE id = NEW.id      AND NEW.table_name = 'invites';
  DELETE FROM dictionaries        WHERE id = NEW.id      AND NEW.table_name = 'dictionaries';
  DELETE FROM email_aliases       WHERE email = NEW.id   AND NEW.table_name = 'email_aliases';
  DELETE FROM users               WHERE id = NEW.id      AND NEW.table_name = 'users';
END;
