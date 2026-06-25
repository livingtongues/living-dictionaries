------------------------------------------------------------------
-- Admin team chat (internal admin-to-admin messaging). Campfire-style:
-- named channel rooms + 1:1 DMs.
--
-- SERVER-ONLY tables: chat is server-authoritative and served through the
-- membership-filtered /api/admin/chat/* endpoints + a 5s poll, NOT through a
-- wa-sqlite sync sector — DMs and the private named channels must never land in
-- a non-member's local DB. These tables are created-but-empty on admin clients
-- (same as email_codes / client_logs); they have no `dirty` column so the sync
-- engine never touches them, and they're absent from SYNCABLE_TABLE_NAMES.
--
-- Rooms (membership in $lib/server/chat/constants.ts → FIXED_CHANNELS):
--   'all-admins'        — every LD admin
--   'anna-greg-jacob'   — Anna / Greg / Jacob
--   'diego-anna-greg'   — Diego / Anna / Greg
-- DM room ids are 'dm:{userA}:{userB}' with the two user ids sorted. Membership
-- is filled lazily as admins log in (ensure_my_chat_setup) + eagerly at boot
-- (ensure_all_admins_in_team_chat).
--
-- `gentle_reping_at` powers the once-per-unread-batch gentle re-ping cron.
------------------------------------------------------------------

CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                 -- 'channel' | 'dm'
  name TEXT,                          -- channel display name; NULL for DMs
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE chat_room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT,                  -- when this user last viewed the room
  last_notified_at TEXT,             -- when we last sent an external ping for this room
  gentle_reping_at TEXT,             -- when the one-time gentle re-ping fired for the current unread batch
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX idx_chat_room_members_user ON chat_room_members (user_id);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,           -- plain-text mirror for previews + notifications
  client_message_id TEXT,            -- idempotent dedup per (room, author)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  edited_at TEXT,
  deleted_at TEXT
);
CREATE INDEX idx_chat_messages_room_created ON chat_messages (room_id, created_at);
CREATE UNIQUE INDEX idx_chat_messages_client ON chat_messages (room_id, author_user_id, client_message_id) WHERE client_message_id IS NOT NULL;

CREATE TABLE chat_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mimetype TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_chat_attachments_message ON chat_attachments (message_id);

CREATE TABLE admin_presence (
  user_id TEXT PRIMARY KEY,
  last_seen_at TEXT NOT NULL,
  current_room_id TEXT
);
