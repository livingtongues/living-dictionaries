-- Add unique-VISITOR counts beside the visit (session) counts on the forever
-- per-dict viewership rollup. `sessions`/`anon_sessions` reset per page-load
-- (visits); these count distinct persistent `visitor_id`s (localStorage, one per
-- browser across days) — the cookieless "how many people" signal for the future
-- public "visitors/month" badge. See .issues/persistent-visitor-id.md.
--
-- `visitors`      = distinct human viewer visitor_ids that opened the dict that day.
-- `anon_visitors` = subset whose session had no user_id (≈ outside public visitors).
--
-- NOTE ON CARDINALITY: these are DAILY-distinct. Summed over a month they give
-- "active visitor-days", NOT true monthly-unique visitors (a person on 5 days
-- sums to 5). TRUE monthly uniques live in the separate `dictionary_monthly_visitors`
-- rollup (migration 20260707d) — a whole-month UNION of visitor_ids. These daily
-- columns stay for daily-granularity trends; the admin panel + public badge read
-- the monthly rollup for the unique counts.
--
-- Separate migration from 20260707a (the table's create) because that one already
-- applied on dev/admin clients; ALTER ADD is the clean, once-applied retrofit.
ALTER TABLE dictionary_daily_views ADD COLUMN visitors INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dictionary_daily_views ADD COLUMN anon_visitors INTEGER NOT NULL DEFAULT 0;
