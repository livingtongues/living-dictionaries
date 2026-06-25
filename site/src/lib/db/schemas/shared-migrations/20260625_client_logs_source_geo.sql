------------------------------------------------------------------
-- client_logs: add `source` + approximate geolocation, stamped server-side
-- at ingest. `source` distinguishes browser entries ('client') from
-- server-side telemetry ('server', via log_server_event). The geo columns
-- come from Cloudflare edge headers (cf-ipcountry / cf-region-code /
-- cf-ipcity / cf-iplatitude / cf-iplongitude) — the "Add visitor location
-- headers" managed transform is enabled on the livingdictionaries.app zone.
-- The origin is in Boston, so distance ≈ TTFB; coords are CF's IP-geolocation
-- centroid (city/ISP grade) — not identifying. Raw client IP is NEVER stored.
-- Existing rows read NULL.
-- Server-only table — created empty on admin clients too (excluded from sync).
------------------------------------------------------------------

ALTER TABLE client_logs ADD COLUMN source    TEXT;   -- 'client' | 'server' (NULL = legacy client row)
ALTER TABLE client_logs ADD COLUMN country   TEXT;   -- ISO 3166-1 alpha-2, e.g. 'US' ('XX'/'T1' = unknown/Tor)
ALTER TABLE client_logs ADD COLUMN region    TEXT;   -- subdivision code from cf-region-code, e.g. 'CA'
ALTER TABLE client_logs ADD COLUMN city      TEXT;   -- cf-ipcity
ALTER TABLE client_logs ADD COLUMN latitude  REAL;   -- cf-iplatitude (IP centroid)
ALTER TABLE client_logs ADD COLUMN longitude REAL;   -- cf-iplongitude (IP centroid)
