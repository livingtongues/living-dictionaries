-- Agent attribution for the change-history log.
--
-- When a change is made through the `/api/v1` write API with an `ldk_` API key,
-- record WHICH key (= which agent) did it. `user_id` already holds the
-- responsible human (the key's creator); this column annotates that a specific
-- agent acted on their behalf. NULL = a human edited directly in the UI.
--
-- `api_key_id` references `shared.db.api_keys.id` (a cross-file reference, so no
-- SQL FK). Keys are revoked, never hard-deleted, so the id always resolves back
-- to a label + creator for the timeline.
ALTER TABLE changes ADD COLUMN api_key_id TEXT;
CREATE INDEX IF NOT EXISTS idx_changes_api_key ON changes(api_key_id);
