-- Add `user_id` to the per-session materialization so the analytics Geography
-- panel can exclude admin (level >= 2) sessions from the located-sessions area
-- tally (admins browsing skew "where visitors come from"). Nullable — anon
-- sessions and pre-migration rows stay NULL. Filter is geo-only; session/user
-- counts + device/OS/browser breakdowns still include admins.
ALTER TABLE log_daily_sessions ADD COLUMN user_id TEXT;
