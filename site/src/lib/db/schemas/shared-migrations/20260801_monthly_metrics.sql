------------------------------------------------------------------
-- monthly_metrics — ONE FROZEN ROW PER MONTH of the numbers we actually
-- report: audience reach, its mission/conlang split, and corpus production
-- split by agent vs hand. Server-only, forever, never pruned.
--
-- WHY THIS TABLE EXISTS (2026-08-01): every figure in it is derived from raw
-- `client_logs` + per-dictionary history dbs, and raw logs prune on a rolling
-- 60 days (`ARCHIVE_WINDOW_DAYS`). The existing forever rollup
-- (`dictionary_monthly_visitors`) preserves only a whole-month visitor union —
-- not the mission/conlang split, not corpus production, and not the
-- device-keyed window. So without this table the month's real numbers become
-- unrecoverable ~60 days later. July 2026 is the pre-surge baseline (big
-- analytics/search + API changes are landing now); losing it would forfeit the
-- starting line for measuring the surge.
--
-- THE WINDOW COLUMNS ARE THE HONESTY. A row records what was measured over an
-- EXPLICIT window rather than a pre-cooked "monthly total":
--   * `visitor_id` (the cookieless device id) only shipped mid-2026-07-07, and
--     before it the visitor rollup falls back to `session_id` — so every early
--     session counts as its own "visitor", inflating uniques and understating
--     the anonymous share. July is therefore measured over 07-08 → 07-31 only.
--   * Every later month is measured over the whole month, so `days_counted`
--     equals the month's length and the run-rate normalization is a NO-OP.
-- Callers normalize with `normalize_visitors()`; nothing here is stored
-- pre-scaled, so a future reader can always see what was really counted.
--
-- Deliberately NOT recorded: anything before `FIRST_METRICS_MONTH` (2026-07).
-- June 2026 raw begins only on 06-26 (prune) and predates the SQLite cutover,
-- so it is not comparable at any granularity and must never be backfilled.
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_metrics (
  month TEXT PRIMARY KEY,              -- 'YYYY-MM' (UTC calendar month)

  -- The measured window (UTC days, inclusive) + its length. `days_counted` is
  -- what makes a partial-capture month comparable to a whole one.
  window_start TEXT NOT NULL,          -- 'YYYY-MM-DD'
  window_end TEXT NOT NULL,            -- 'YYYY-MM-DD'
  days_counted INTEGER NOT NULL,

  -- Site-wide reach: distinct BROWSERS/DEVICES (never "people"), unioned over
  -- the window from `session_start`. Bots excluded by the same classifier the
  -- daily/monthly rollups use, so hot and cold days agree.
  site_visitors INTEGER NOT NULL,
  site_visits INTEGER NOT NULL,
  site_anon_visitors INTEGER NOT NULL, -- devices with >=1 signed-out session

  -- Mean NEW (first-seen-in-window) visitors per day. This is what makes a
  -- forward run-rate defensible: uniques are a union and cannot be scaled
  -- linearly, but a flat arrival rate can be extended. July measured 216/day
  -- with no decay across 24 days.
  new_visitor_rate REAL NOT NULL,

  -- Mission = bucket 'public' + 'unlisted' (real languages). Fenced = 'conlang'
  -- + 'glossary', kept separate from mission reporting per the 2026-07-08
  -- decision. These are true UNIONs recomputed from raw — per-dictionary rows
  -- in `dictionary_monthly_visitors` OVERLAP and must never be summed.
  mission_visitors INTEGER NOT NULL,
  mission_visits INTEGER NOT NULL,
  mission_anon_visitors INTEGER NOT NULL,
  fenced_visitors INTEGER NOT NULL,

  -- Corpus STOCK at the moment the row was computed (not a window quantity).
  public_dictionaries INTEGER NOT NULL,
  public_entries INTEGER NOT NULL,
  platform_dictionaries INTEGER NOT NULL,
  platform_entries INTEGER NOT NULL,

  -- Corpus FLOW: entries created during the month that still exist. Split by
  -- `changes.api_key_id` in each dictionary's history db — non-NULL = written
  -- by an agent through /api/v1, NULL = a human typing in the UI. `unattributed`
  -- covers rows whose insert predates history or whose history db is missing.
  mission_entries_created INTEGER NOT NULL,
  mission_entries_agent INTEGER NOT NULL,
  mission_entries_hand INTEGER NOT NULL,
  mission_entries_unattributed INTEGER NOT NULL,
  fenced_entries_created INTEGER NOT NULL,

  computed_at TEXT NOT NULL,
  -- Stamped once the month's summary has been posted to the admin chat room.
  -- The idempotency guard for the announcement — never post twice.
  announced_at TEXT
);
