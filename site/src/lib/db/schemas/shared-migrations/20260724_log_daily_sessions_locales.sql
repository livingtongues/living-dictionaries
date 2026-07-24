------------------------------------------------------------------
-- Locale demand tracking (which i18n languages to add next):
--   visitor_id     — persistent per-browser id so locale panels count TRUE
--                    unique visitors (COALESCE to session_id for older days,
--                    same convention as dictionary_daily_views).
--   browser_locale — primary Accept-Language tag (e.g. 'pt-BR'), stamped
--                    server-side on client_logs at /api/log ingest.
--   ui_locale      — the locale the UI actually rendered in (session_start
--                    context), so browser preference vs in-use language can
--                    be compared (supported-but-unused = discovery problem).
-- Server-only rollup (created on clients by the shared migration runner but
-- excluded from the syncable set, like the other log_* rollups).
------------------------------------------------------------------

ALTER TABLE log_daily_sessions ADD COLUMN visitor_id TEXT;
ALTER TABLE log_daily_sessions ADD COLUMN browser_locale TEXT;
ALTER TABLE log_daily_sessions ADD COLUMN ui_locale TEXT;
