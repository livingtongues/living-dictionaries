-- Initial migration for Living Dictionaries' `shared.db`.
-- Runs on BOTH the server's shared.db AND every admin client's wa-sqlite local DB.
-- Server-only tables (email_codes, email_aliases, client_logs) get created on
-- the client too but stay empty — they're excluded from `SYNCABLE_TABLE_NAMES`
-- in db/sync/types.ts so they never flow over the wire.
--
-- Conventions:
--
-- * Enum-shaped columns are documented via Drizzle's `text({ enum: [...] })`
--   in `shared.ts`, which is a TypeScript-only hint — SQLite itself has no
--   CHECK constraint here. Validation lives at the app boundary.
--
-- * Synthetic UUID primary keys on junction tables (dictionary_roles) +
--   UNIQUE on the natural key — see Q8 in port-db-sync-architecture.md.
--
-- * `last_visit_at` trigger is borrowed verbatim from house — bumps users.updated_at
--   when last_visit_at moves so admin clients pick it up on the next sync.

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  run_on TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

------------------------------------------------------------------
-- Auth + identity (admin-visible; users syncs to admin clients)
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  -- COLLATE NOCASE so 'Alice@x.com' and 'alice@x.com' resolve to the same
  -- user — matches email_aliases.email and SMTP semantics.
  email TEXT UNIQUE COLLATE NOCASE,
  name TEXT,
  avatar_url TEXT,
  -- JSON array of linked auth identities [{provider, provider_id}, ...].
  providers TEXT NOT NULL DEFAULT '[]',
  -- ISO 8601 timestamp of when the user unsubscribed from non-transactional
  -- email. NULL = still subscribed. App layer surfaces a boolean. Legacy LD
  -- stored this as a TIMESTAMPTZ — same shape preserved for clean cutover.
  unsubscribed_from_emails TEXT,
  -- Preferred i18n locale for outbound email + SSR layout. Maps to one of
  -- the locales in lib/i18n/locales/. NULL = derive from Accept-Language.
  preferred_locale TEXT,
  last_visit_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_last_visit_at ON users(last_visit_at);

-- Email-OTP one-time codes. Server-only — stays empty on admin clients.
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email);

-- Additional emails that resolve to a user's canonical row.
-- Server-only — read-only on admin clients.
CREATE TABLE IF NOT EXISTS email_aliases (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'auth' | 'manual' | 'inbound-match' | 'historical-merge'
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_aliases_user_id    ON email_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_email_aliases_updated_at ON email_aliases(updated_at);

-- Tombstones for admin sync. Composite PK matches the (table_name, id) pull pattern.
CREATE TABLE IF NOT EXISTS deletes (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (table_name, id)
);
CREATE INDEX IF NOT EXISTS idx_deletes_table_updated_at ON deletes(table_name, updated_at);

------------------------------------------------------------------
-- Dictionary catalog. Per-dictionary content lives in dictionaries/{id}.db.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dictionaries (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE,
  name TEXT NOT NULL,
  alternate_names TEXT,
  gloss_languages TEXT,
  location TEXT,
  coordinates TEXT,
  iso_639_3 TEXT,
  glottocode TEXT,
  public INTEGER,
  print_access INTEGER,
  metadata TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  orthographies TEXT,
  featured_image TEXT,
  author_connection TEXT,
  community_permission TEXT,
  language_used_by_community INTEGER,
  con_language_description TEXT,
  copyright TEXT,
  hide_living_tongues_logo INTEGER,
  -- Long-form dictionary metadata (legacy `dictionary_info`, 1:1 with a dict).
  about TEXT,
  citation TEXT,
  grammar TEXT,
  write_in_collaborators TEXT, -- JSON string[]
  -- Last `dict.db.db_metadata.last_modified_at` mirrored here by the push
  -- endpoint. The snapshot builder cron queries
  --   WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970-01-01')
  -- to find dicts that need a fresh R2 snapshot.
  snapshot_uploaded_at TEXT,
  -- Last migration applied to this dict's dictionaries/{id}.db file.
  -- NULL = newly registered, not yet opened by get_dictionary_db.
  dict_db_schema_version TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  dirty INTEGER
);
CREATE INDEX IF NOT EXISTS idx_dictionaries_updated_at ON dictionaries(updated_at);
CREATE INDEX IF NOT EXISTS idx_dictionaries_public ON dictionaries(public) WHERE public = 1;
CREATE INDEX IF NOT EXISTS idx_dictionaries_snapshot_uploaded_at
  ON dictionaries(snapshot_uploaded_at);

-- Per-dictionary role grants. Synthetic UUID PK + UNIQUE on (dictionary_id, user_id, role).
CREATE TABLE IF NOT EXISTS dictionary_roles (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'manager' | 'editor' | 'contributor'
  invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  dirty INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (dictionary_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_dictionary_roles_dict ON dictionary_roles(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_roles_user ON dictionary_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_roles_updated_at ON dictionary_roles(updated_at);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inviter_email TEXT NOT NULL,
  target_email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL, -- 'manager' | 'editor' | 'contributor'
  status TEXT NOT NULL, -- 'queued' | 'sent' | 'claimed' | 'cancelled'
  dirty INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_invites_dict ON invites(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_invites_target ON invites(target_email);
CREATE INDEX IF NOT EXISTS idx_invites_updated_at ON invites(updated_at);

-- Partner organizations shown on a dictionary's about page. Legacy
-- `dictionary_partners` referenced a `photos` row by id, but photos now live in
-- the per-dict db; the logo is denormalized here (serving_url + storage_path) so
-- the about page renders entirely from shared.db.
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

------------------------------------------------------------------
-- Client logs (server-only). POSTed from the browser to /api/log.
-- Created on admin client DBs too but stays empty (excluded from sync).
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_logs (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  client_time TEXT,
  user_id TEXT,
  level TEXT NOT NULL, -- 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  platform TEXT,
  app_version TEXT,
  build_target TEXT,
  context TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_logs_received_at ON client_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id     ON client_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_level       ON client_logs(level);

------------------------------------------------------------------
-- Messages: support threads + individual messages + attachments.
-- Bidirectional sync to admin clients (same single sector as the rest of
-- LD's shared.db — Q-shared.3 in port-db-sync-architecture.md).
--
-- FK cascade chain on customer-delete:
--   users(deleted) → message_threads (CASCADE via from_user_id)
--                  → messages (CASCADE via thread_id)
--                  → message_attachments (CASCADE via message_id)
------------------------------------------------------------------

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

------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------

-- Auto-bump users.updated_at whenever last_visit_at advances (so the change
-- flows to admin clients via the sync engine's updated_at watermark).
CREATE TRIGGER IF NOT EXISTS users_after_last_visit_at_bump_updated_at
AFTER UPDATE OF last_visit_at ON users
WHEN COALESCE(OLD.last_visit_at, '') IS NOT COALESCE(NEW.last_visit_at, '')
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- The `deletes` table is the canonical "this row was removed" signal;
-- inserting a tombstone IS the delete operation, and this trigger keeps the
-- actual tables in lockstep with the tombstone log on every DB (server +
-- every admin client). See house's `process_delete_cascade` for full rationale.
--
-- Tables keyed by something other than `id`:
--   - email_aliases is keyed by `email`
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
