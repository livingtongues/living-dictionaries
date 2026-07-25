-- Import conversations (see .issues/import-conversations.md).
--
-- Turns an import request from a transient admin-inbox thread into a durable
-- manager-facing conversation on the dictionary: `/{dict}/import/{thread_id}`.
-- The thread row itself is unchanged storage — what's new is a manager window,
-- a freeze stamp, and three server-only child tables (resources already live in
-- `source_files`).

-- 'import' threads are worked on the dictionary's own conversation page and are
-- filtered OUT of /admin/messages. NULL = every legacy contact_form/email thread.
ALTER TABLE message_threads ADD COLUMN thread_kind TEXT;

-- Stamped when the team begins work (guide Phase 0). This is the ENTIRE freeze
-- rule: once set, the uploaded resources become permanent dictionary history and
-- managers can no longer edit or delete them. Before it they may withdraw.
ALTER TABLE message_threads ADD COLUMN started_at TEXT;
ALTER TABLE message_threads ADD COLUMN started_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Notification dedupe counter. Incremented when an admin opens the conversation;
-- the Notifications-room notice is posted with
-- `client_message_id = 'import-activity:{thread_id}:{activity_batch}'`, and
-- chat_messages' UNIQUE (room_id, author_user_id, client_message_id) index makes
-- a repeat post inside the same unread batch a no-op at the DB level.
ALTER TABLE message_threads ADD COLUMN activity_batch INTEGER;

CREATE INDEX IF NOT EXISTS idx_message_threads_kind_dictionary
  ON message_threads(thread_kind, dictionary_id, last_message_at);

-- SERVER-ONLY (like source_files: deliberately NOT in the shared-sync allowlist).
-- Who is in a conversation, and the per-person notification bookkeeping that
-- gives us chat's one-ping-per-unread-batch policy. `side` records which window
-- they speak from; membership is additive (posting joins you).
CREATE TABLE IF NOT EXISTS thread_participants (
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL,                  -- 'manager' | 'team'
  last_read_at TEXT,
  last_notified_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON thread_participants(user_id);

-- SERVER-ONLY. Generated HTML artifacts (the pre-write preview, the post-write
-- report). Bytes live in the private attachments bucket under
-- `import/{dictionary_id}/artifacts/{id}.html`; rendered in a sandboxed iframe on
-- the conversation page and downloadable. Frozen snapshots — never regenerated
-- in place, so the record of what we said at the time stays honest.
CREATE TABLE IF NOT EXISTS thread_artifacts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  dictionary_id TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- 'preview' | 'report'
  title TEXT,
  storage_key TEXT NOT NULL,
  mimetype TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  import_id TEXT,                      -- the v1 write batch this reports on
  source_id TEXT,                      -- dict-db sources.id (cross-db, no FK)
  stats_json TEXT,                     -- {entries, senses, review_flags, ...}
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_artifacts_thread ON thread_artifacts(thread_id, created_at);

-- SERVER-ONLY. The questions an import raises, as answerable objects rather than
-- prose buried in an email. Long-form context (examples, links to live entries)
-- stays in the report artifact; `report_anchor` deep-links there.
CREATE TABLE IF NOT EXISTS thread_questions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  dictionary_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,                  -- 'text' | 'choice' | 'multi_choice'
  title TEXT NOT NULL,
  body_html TEXT,                      -- short context (trusted, agent-authored)
  options_json TEXT,                   -- [{value,label}] for the choice kinds
  report_anchor TEXT,
  answer_text TEXT,
  answer_values_json TEXT,             -- selected option values for the choice kinds
  answered_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  answered_at TEXT,
  status TEXT NOT NULL,                -- 'open' | 'answered' | 'closed'
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_questions_thread ON thread_questions(thread_id, position);

------------------------------------------------------------------
-- Backfill the threads that already exist (Enxet, Eastern Pomo)
------------------------------------------------------------------

UPDATE message_threads SET thread_kind = 'import'
WHERE thread_kind IS NULL
  AND EXISTS (SELECT 1 FROM source_files WHERE source_files.import_thread_id = message_threads.id);

-- Every pre-existing import request had already been started by hand.
UPDATE message_threads SET started_at = COALESCE(replied_at, resolved_at, created_at)
WHERE thread_kind = 'import' AND started_at IS NULL;

UPDATE message_threads SET activity_batch = 0 WHERE activity_batch IS NULL;

INSERT OR IGNORE INTO thread_participants (thread_id, user_id, side, created_at)
SELECT id, from_user_id, 'manager', created_at
FROM message_threads WHERE thread_kind = 'import' AND from_user_id IS NOT NULL;

INSERT OR IGNORE INTO thread_participants (thread_id, user_id, side, created_at)
SELECT id, assigned_to_user_id, 'team', COALESCE(assigned_at, created_at)
FROM message_threads WHERE thread_kind = 'import' AND assigned_to_user_id IS NOT NULL;
