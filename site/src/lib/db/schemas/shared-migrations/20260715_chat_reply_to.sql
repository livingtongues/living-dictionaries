------------------------------------------------------------------
-- chat_messages.reply_to_message_id — Discord-style reply references.
--
-- A message may reference ONE earlier message in the SAME room (validated in
-- app code — SQLite ALTER can't add a FK). The referenced row is live-resolved
-- on every fetch (author + current text snippet + a deleted flag) so edits and
-- deletes to the original stay reflected in the quote-line.
--
-- Server-only like the rest of the chat tables (reached ONLY via /api/chat/* —
-- never a sync sector, no dirty columns). Created on admin clients too but
-- stays unused there. Nullable → safe ALTER on both sides.
------------------------------------------------------------------

ALTER TABLE chat_messages ADD COLUMN reply_to_message_id TEXT;
