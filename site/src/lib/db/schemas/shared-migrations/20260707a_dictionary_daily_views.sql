-- Per-dictionary daily viewership — a tiny FOREVER rollup (never pruned) written
-- by the retention cron's rollup_day() from `client_logs` `dictionary_opened`
-- events (bots excluded, SAME classifier as log_daily_metrics). Feeds the daily
-- "Visits" activity column of the admin "Top dictionaries by unique visitors" panel
-- (unique counts come from the separate dictionary_monthly_visitors rollup).
--
-- `sessions`      = distinct human viewer-sessions that opened the dict that day.
-- `anon_sessions` = subset whose session had no user_id (≈ outside public visitors,
--                   the number worth showing off for star dicts).
-- NOTE: a session_id resets per page-load, so daily-distinct summed over a month is
-- "visits", NOT unique "visitors" — true monthly uniques await the cookieless
-- visitor_hash (dashboard-improvements.md backlog).
--
-- Lives in shared.db beside log_daily_metrics / log_daily_sessions (the durable,
-- backed-up aggregates) — NOT logs.db (disposable/not-backed-up raw rows). Server-only
-- (absent from SYNCABLE_TABLE_NAMES) — created empty on admin wa-sqlite clients. The
-- composite PK's leading `day` serves day-range scans; the extra index serves the
-- per-dictionary time series (future monthly aggregation).
CREATE TABLE IF NOT EXISTS dictionary_daily_views (
  day           TEXT NOT NULL,               -- 'YYYY-MM-DD' UTC
  dictionary_id TEXT NOT NULL,
  sessions      INTEGER NOT NULL DEFAULT 0,
  anon_sessions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dictionary_id)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_daily_views_dict ON dictionary_daily_views (dictionary_id, day);
