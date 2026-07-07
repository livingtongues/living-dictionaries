# Persistent client visitor_id — cookieless unique-visitor capture

Follow-on from `.issues/dictionary-viewership-and-nav-speed-telemetry.md` (2026-07-07). That shipped
per-dict **visits** (distinct `session_id`/day, resets per page-load). Jacob wants **visitors** — a
cookieless persistent id, chosen over the server IP+UA `visitor_hash` because it beats the NAT-collapse
failure common to LD's shared-connection communities, with no cookie/consent surface (GDPR is an
explicit non-concern for a random UUID we mint and never join to identity).

## Method (decided with Jacob)
A UUID generated once, stored in `localStorage`, reused across page loads + days. Rides every log row's
`context.visitor_id` exactly like `session_id` already does. `session_id` = one page load (visits);
`visitor_id` = one browser/device across time (visitors). "Visitors" universally means distinct
devices/browsers, not humans — stated honestly on any public surface.

## Build checklist
- ✅ **Client** `remote-log.ts` — `ensure_visitor_id()` reads-or-creates `ld_visitor_id` in localStorage
  at init (sync, before first `session_start`); `enrich()` stamps `context.visitor_id`.
- ✅ **Ingest** `insert-client-log.ts` — promotes `context.visitor_id` → real `visitor_id` column + INSERT.
- ✅ **Schema** `logs-db.ts` — `visitor_id` in `CLIENT_LOG_COLUMNS` + `CLIENT_LOGS_TABLE_SQL`; retrofit
  ALTER loop in `open_logs_db`; split now copies only columns present on the source shared.db (so a
  post-split column never 500s the one-time migration). Archive auto-retrofits.
- ✅ **shared.db** migration `20260707c_client_logs_visitor_id.sql` — ADD `visitor_id` to the legacy
  `client_logs` (mirrors the session_id migration; needed so server-event tests + pre-split copy work).
- ✅ **Rollup columns** migration `20260707b_dictionary_daily_views_visitors.sql` — ADD `visitors`,
  `anon_visitors`.
- ✅ **Rollup** `rollup_day()` — SELECTs `visitor_id`; counts distinct `visitor_id ?? session_id`
  (+ anon subset) per dict/day; writes the two columns.
- ✅ **Reader** `build_top_dictionaries` — cold reads visitors/anon_visitors; live tail
  COUNT(DISTINCT COALESCE(visitor_id, session_id)); exposes `visitors_30d`/`anon_visitors_30d` per row
  + a `visitors_30d` summary.
- ✅ **Panel** `AnalyticsView.svelte` — "Visitor-days · 30d" stat + a "Visitors" table column + honest
  visits-vs-visitors note. Screenshot-verified light + dark.
- ✅ **Tests** mock + inline analytics snapshot + insights fixture + rollup test (new
  visits>visitors case) + insert-client-log promotion test. All green.
- ✅ **Docs** knowledge (`analytics-telemetry.md`) + deferred public-badge issue + backlog item updated.
- ✅ **House handoff** — spawned house session `8cbe9966-fa9c-4e73-9728-857422eb73f3` (exploratory:
  port visitor_id + capture referrer/UTM for anonymous-source attribution, house's login-heavy angle).
  Tail with `horse tail house 8cbe9966-fa9c-4e73-9728-857422eb73f3`.

## Verification
`pnpm vitest run` on the touched files + full-suite: all pass except ONE PRE-EXISTING unrelated failure
(`api/dictionary/[id]/entry/[entryId]/server.test.ts > admin session widens tag visibility` — fails on
clean `main` too, from entry-SSR commit `1dcf2e5a`; flagged to Jacob, not mine to fix). `pnpm check` 0
errors. lint clean.

## CORRECTIONS (2026-07-07 follow-up — see `.issues/true-unique-visitors.md`)
- **`20260707c_client_logs_visitor_id.sql` was DELETED.** It ALTERed `client_logs` on shared.db, but the
  boot-time split DROPS that table → threw `no such table: client_logs` on every already-split shared.db
  (boot-breaking; also the REAL cause of the entry-SSR test failure below — NOT pre-existing; `git stash`
  skips untracked files, so the earlier stash-test was invalid). logs.db owns `visitor_id` via its own
  DDL + retrofit; shared.db never needed it.
- **`insert_client_log` writing `visitor_id` also broke `log_server_event({ db: shared_db })`** (sync
  drift logging) — fixed by pointing that logging at logs.db.
- **The cardinality nuance below is now RESOLVED** by the forever `dictionary_monthly_visitors` rollup.

## Cardinality nuance (RESOLVED by the monthly rollup — was: flag to Jacob)
Daily-distinct visitor counts **summed** over a month = "active visitor-days", NOT true monthly uniques
(a visitor on 5 days sums to 5). True monthly uniques need a UNION of the raw `visitor_id`s over the
range. Two ways at badge time (~1mo out): (a) compute from raw `client_logs` — visitor_id survives the
60-day hot+archive window, enough for a rolling 30d; (b) add a forever monthly-distinct rollup then. The
daily columns added now are still a strict improvement (daily-unique vs per-load) and power the admin
panel today. Decide (a)/(b) when the public badge ships.
