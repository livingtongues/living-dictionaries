# Public "visits / month" badge on dictionary home pages (~1 month out)

Deferred from `.issues/dictionary-viewership-and-nav-speed-telemetry.md` (2026-07-07). The forever
per-dictionary viewership rollup (`dictionary_daily_views` in shared.db) + the admin "Top dictionaries
by viewers" panel shipped then; this is the *public-facing* half Jacob wants a month later once a
month of data has accumulated.

## Goal
On a (star) dictionary's home page (`/[dictionaryId]/home`, admin-3 preview today — eventually the
default dict landing), show an "≈ N visits / month" stat so communities get props for the traffic
their dictionary pulls. Hide it when the number isn't flattering (small/new dicts, or private) — show
it only for public dicts above some threshold, and definitely for the starred/featured ones.

## Data is already captured
`dictionary_daily_views(day, dictionary_id, sessions, anon_sessions)` — distinct human sessions per
dict per day, bots excluded, never pruned (see `.knowledge/admin/analytics-telemetry.md`). Sum the
last ~30 days (or average across whole months) → "visits/month". Use `anon_sessions` for the
"outside public visitors" framing; total `sessions` for all activity.

## The one real design task: get the number to the browser
The rollup is server-only shared.db (never syncs). The public dict home reads dict.db (synced) +
catalog. Options (decide then):
1. **Bake into the dict.db snapshot** — the r2-snapshot-builder writes a `stats`/`meta` row (e.g.
   `featured_entries`-style) with the rolled monthly visits when it rebuilds a dict. Public visitors
   already download the snapshot, so it arrives for free. Recompute cheaply from
   `dictionary_daily_views` at snapshot-build time.
2. **Bake into the `dictionaries` catalog row** — add `monthly_visits` (nullable int), recomputed by
   the retention cron (or a small monthly cron) after each rollup; syncs/serves via the catalog the
   homepage globe already loads. Simpler if the homepage/dict pages read catalog.

Recommend (1) if the number is dict-home-only; (2) if the homepage globe / dictionaries list also
wants it. Likely (1) first.

## Caveat to surface honestly
"Visits", NOT unique "visitors" (session_id resets per page-load). If we want true monthly uniques,
ship the cookieless `visitor_hash` first (dashboard-improvements.md backlog) and roll a
`visitor_hash`-distinct count into `dictionary_daily_views`. Until then, label it "visits" (or "views").

## Also consider
- Threshold + opt-out: don't embarrass low-traffic dicts. Per-dict toggle? Or auto-hide < N.
- Exclude the dict's own team for a truer "outside interest" number (needs a per-dict membership join
  at rollup or display time — `anon_sessions` is the cheap proxy we already store).
- A small 6–12 month sparkline of monthly visits on the dict home for the star dicts.
