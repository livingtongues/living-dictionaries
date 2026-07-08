------------------------------------------------------------------
-- Emoji reactions on chat messages. Server-only like the rest of the
-- chat tables (reached ONLY via /api/chat/* — never a sync sector, no
-- dirty columns). Created on admin clients too but stays empty there.
--
-- One row per (message, user, emoji); toggling a reaction inserts or
-- deletes that row. `emoji` is the literal grapheme string (e.g. '👍').
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions (message_id);
