------------------------------------------------------------------
-- Squashed 2026-07-03 changes (none of these had reached prod, so they
-- ship as one file per our keep-few-migrations rule):
--   1. users.roles — DB-grantable site-wide roles
--   2. messages.cc / messages.bcc — persist Cc/Bcc on outbound admin mail
--   3. DB-managed chat channels — chat moves out of /admin to /chat and
--      FIXED_CHANNELS dies: every channel is a chat_rooms row, managed in
--      the UI. admin_room = 1 rooms are only manageable by super admins.
--   4. Retire the old 'anna-greg-jacob' channel (replaced by 'diego-greg-jacob').
--   5. i18n translator backend — DB-backed translations replace the Google
--      Sheet: i18n_keys / i18n_translations / translator_languages.
------------------------------------------------------------------

-- Site-wide DB-grantable roles (JSON array of SiteRole strings, e.g.
-- '["super_manager"]'). NULL = no roles. Levels 2/3 stay in the hardcoded
-- $lib/admins.ts allow-list; this column only grants effective level 1.
ALTER TABLE users ADD COLUMN roles TEXT;

-- messages.cc / messages.bcc: persist Cc + Bcc recipients on outbound admin
-- messages (compose + reply) so the admin UI can show who was copied after
-- the fact. Display-only; comma-joined; NULL for inbound and for outbound
-- messages with no Cc/Bcc.
ALTER TABLE messages ADD COLUMN cc TEXT;
ALTER TABLE messages ADD COLUMN bcc TEXT;

-- DB-managed channels: who created it (NULL for seeded/system rooms) and
-- whether it's an admin room (rename/delete/membership changes gated to
-- super admins, level 3; other channels are manageable by admins, level 2).
ALTER TABLE chat_rooms ADD COLUMN created_by_user_id TEXT;
ALTER TABLE chat_rooms ADD COLUMN admin_room INTEGER NOT NULL DEFAULT 0;

-- The 'anna-greg-jacob' channel was retired (replaced by 'diego-greg-jacob').
-- Chat tables exist on admin clients too (created, not synced), so this is
-- safe to run on both sides.
DELETE FROM chat_attachments WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id = 'anna-greg-jacob');
DELETE FROM chat_messages WHERE room_id = 'anna-greg-jacob';
DELETE FROM chat_room_members WHERE room_id = 'anna-greg-jacob';
DELETE FROM chat_rooms WHERE id = 'anna-greg-jacob';

-- Seed the formerly-fixed channels as DB rows (idempotent — prod already has
-- them from the lazy upsert era). All four are admin rooms. The two 'all'
-- rooms (all-admins + notifications) get admin membership from the boot step
-- (ensure_all_admins_in_team_chat), which also creates missing user rows.
INSERT INTO chat_rooms (id, kind, name) VALUES
  ('all-admins', 'channel', 'All Admins'),
  ('notifications', 'channel', 'Notifications'),
  ('diego-greg-jacob', 'channel', 'Diego, Greg & Jacob'),
  ('diego-anna-greg', 'channel', 'Diego, Anna & Greg')
ON CONFLICT (id) DO NOTHING;
UPDATE chat_rooms SET admin_room = 1 WHERE id IN ('all-admins', 'notifications', 'diego-greg-jacob', 'diego-anna-greg');

-- Membership for the two explicit-member admin rooms, resolved by email.
-- No-op wherever those users rows don't exist (e.g. fresh admin clients,
-- where chat tables are vestigial anyway — data flows via the API).
INSERT OR IGNORE INTO chat_room_members (room_id, user_id)
  SELECT 'diego-greg-jacob', id FROM users WHERE email IN ('diego@livingtongues.org', 'livingtongues@gmail.com', 'jwrunner7@gmail.com');
INSERT OR IGNORE INTO chat_room_members (room_id, user_id)
  SELECT 'diego-anna-greg', id FROM users WHERE email IN ('diego@livingtongues.org', 'dictionaries@livingtongues.org', 'livingtongues@gmail.com');

------------------------------------------------------------------
-- 5. i18n translator backend. Server-only tables (like the chat tables,
--    reached ONLY via /api endpoints — never a sync sector, no dirty
--    columns). English stays in code; these hold the mirrored EN catalog
--    plus every non-English value. This section was APPENDED after some dev
--    DBs had already recorded this migration — it's pure IF NOT EXISTS, so
--    those DBs were patched by running just this section by hand; admin
--    browser mirrors that lack the tables are unaffected (nothing reads
--    them client-side).
------------------------------------------------------------------

-- English key catalog, mirrored from the code's en.json files at every server
-- boot (sync_en_catalog). id = full dotted key ('misc.add'; the item part may
-- itself contain dots, e.g. 'ps.pr.n' — splitting uses the FIRST period only).
CREATE TABLE IF NOT EXISTS i18n_keys (
  id TEXT PRIMARY KEY,
  en_value TEXT NOT NULL,
  en_updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Soft delete: stamped when the key disappears from code, cleared if it returns.
  removed_at TEXT
);

-- One translated value per (key, locale); a missing translation = no row.
-- source: 'import' (sheet-era seed) | 'human' | 'ai'.
-- needs_review: NULL = fine; 'ai' = machine translation awaiting a translator;
-- 'en_changed' = the English source changed after this value was written.
CREATE TABLE IF NOT EXISTS i18n_translations (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES i18n_keys(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  needs_review TEXT,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- Name snapshot at write time (identity-tracking convention).
  updated_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (key_id, locale)
);
CREATE INDEX IF NOT EXISTS idx_i18n_translations_locale ON i18n_translations(locale);

-- Translator assignments: having ANY row = translator (gates /translate + the
-- UserMenu link). Admins (level >= 2) are implicitly translators for every
-- locale and never need rows here.
CREATE TABLE IF NOT EXISTS translator_languages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, locale)
);
