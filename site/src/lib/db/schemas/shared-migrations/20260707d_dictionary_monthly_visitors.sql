-- FOREVER monthly TRUE-unique-visitor rollup (never pruned) written by the
-- retention cron's rollup_month() from raw `client_logs` (hot logs.db ∪ archive).
-- Where dictionary_daily_views is DAILY-distinct (summing over a month gives
-- "visitor-DAYS", overcounting a person seen on N days as N), this stores the
-- UNION of distinct visitor_ids over each whole calendar month — the TRUE unique
-- visitor count. Recomputed each sweep for months whose raw rows still exist
-- (≤60d retention), then frozen once the month is complete, so the number
-- survives the raw prune forever. Powers the admin "Top dictionaries by unique
-- visitors" panel (per-dict monthly uniques) and the future public "visitors/month" badge.
--
-- `scope`         = a dictionary_id (distinct visitors who OPENED that dict, from
--                   `dictionary_opened` events), OR '__site__' for the whole-site
--                   combined count (distinct visitors who started ANY session,
--                   from `session_start` events — a visitor who browses several
--                   dicts is ONE site visitor, so this is NOT the sum of per-dict).
-- `visits`        = distinct session_id (resets per page-load).
-- `anon_visits`   = subset whose session had no user_id (≈ outside public).
-- `visitors`      = distinct persistent visitor_id (falls back to session_id for
--                   pre-2026-07-07 rows) — the TRUE unique-people proxy.
-- `anon_visitors` = anonymous subset of `visitors`.
--
-- "Visitors" = distinct browsers/devices, NOT humans (a shared device reads as
-- one; one person across devices reads as several) — the universal cookieless
-- meaning. Bots excluded (same UA+webdriver+frequency classifier as the daily
-- rollup). Server-only (absent from SYNCABLE_TABLE_NAMES) — created empty on
-- admin wa-sqlite clients.
CREATE TABLE IF NOT EXISTS dictionary_monthly_visitors (
  month         TEXT NOT NULL,               -- 'YYYY-MM' UTC
  scope         TEXT NOT NULL,               -- dictionary_id, or '__site__'
  visits        INTEGER NOT NULL DEFAULT 0,
  anon_visits   INTEGER NOT NULL DEFAULT 0,
  visitors      INTEGER NOT NULL DEFAULT 0,
  anon_visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (month, scope)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_monthly_visitors_scope ON dictionary_monthly_visitors (scope, month);
