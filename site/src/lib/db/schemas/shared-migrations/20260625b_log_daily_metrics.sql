------------------------------------------------------------------
-- log_daily_metrics: tiny FOREVER rollup of client_logs so usage / error /
-- geo trends survive long after the raw rows are archived + pruned. The nightly
-- log-retention cron aggregates each day BEFORE archival. Read live, server-side,
-- by /admin/analytics (NOT synced local-first).
--
-- `metric` is a namespaced key:
--   'sessions' | 'users' | 'logs' | 'errors'
--   'level:<level>'      e.g. level:error
--   'event:<message>'    e.g. event:search_performed, event:heartbeat
--   'nav:<route_bucket>' e.g. nav:dictionaries, nav:dictionary:entry
--   'geo:<area>'         e.g. geo:US-CA, geo:GB (distinct sessions per area)
-- Server-only table — created empty on admin clients too (excluded from sync),
-- and wiped from the viewer snapshot.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS log_daily_metrics (
  day    TEXT NOT NULL,                  -- 'YYYY-MM-DD' UTC
  metric TEXT NOT NULL,                  -- namespaced key (see above)
  source TEXT NOT NULL DEFAULT 'client', -- 'client' | 'server'
  value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, source)
);
CREATE INDEX IF NOT EXISTS idx_log_daily_metrics_day ON log_daily_metrics(day DESC);
