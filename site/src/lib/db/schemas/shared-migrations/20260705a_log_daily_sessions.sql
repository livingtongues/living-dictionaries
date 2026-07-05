-- Per-day per-session materialization so the capability / geo panels + the
-- UA-frequency bot-session classification never re-scan raw rows for finalized
-- (rolled-up, watermark-covered) days. Written by the retention cron's
-- rollup_day() alongside log_daily_metrics; read by log-analytics'
-- window_sessions (materialized finalized days + live tail, merged by session_id).
--
-- Server-only (absent from SYNCABLE_TABLE_NAMES) — created empty on admin
-- wa-sqlite clients like log_daily_metrics / client_logs.
CREATE TABLE IF NOT EXISTS log_daily_sessions (
  day TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_agent TEXT,
  heartbeats INTEGER NOT NULL DEFAULT 0,
  has_user_id INTEGER NOT NULL DEFAULT 0,
  webdriver INTEGER,
  db_tier TEXT,
  country TEXT,
  region TEXT,
  PRIMARY KEY (day, session_id)
);
