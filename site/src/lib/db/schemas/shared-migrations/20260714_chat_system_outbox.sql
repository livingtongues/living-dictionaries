------------------------------------------------------------------
-- chat_system_outbox — the queue for System-authored chat messages.
--
-- Jacob's agent posts as the System bot into any room (e.g. a DM with a
-- partner) so the recipient knows it's the agent, not Jacob. Pings need the
-- SvelteKit runtime (SES/ntfy), so the agent can't just raw-INSERT a message +
-- ping. Instead it inserts ONE row here (dev `.data/shared.db`, prod via
-- `docker exec node`), and `system-outbox-cron.ts` drains it: posts the message
-- as System (bypassing membership) + fires the normal member notification.
--
-- `skip_user_id` is the human the agent posts on behalf of — they aren't pinged
-- for their own agent's message.
--
-- Server-only: never synced to admin clients.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_system_outbox (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,             -- plain-text mirror for previews + the ping
  skip_user_id TEXT,                   -- member NOT to ping (the on-behalf-of human)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at TEXT,                   -- stamped once the cron has posted + pinged
  error TEXT                           -- non-null when processing failed (still stamped processed)
);
CREATE INDEX IF NOT EXISTS idx_chat_system_outbox_pending ON chat_system_outbox (created_at) WHERE processed_at IS NULL;
