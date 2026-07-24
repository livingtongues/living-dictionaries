# Locale tracking + analytics panel + SWR cache — ✅ DONE (2026-07-24)

Track two locale metrics so we can data-drive which i18n languages to add
(context: Greg/Cailie's language wishlist in the diego-greg-jacob chat; AI
assessment posted 2026-07-24):

1. **Browser preference** — what the visitor's browser is set to, supported or not.
   Captured SERVER-side at `/api/log` ingest from the `Accept-Language` header →
   `client_logs.browser_locale` column (primary tag, e.g. `pt-BR`, parsed by
   `$lib/server/browser-locale-from-request.ts`), stamped like geo on every row.
2. **UI locale in use** — the resolved locale the UI rendered in. Client sends
   `ui_locale` in `session_start` context (`init_remote_logging({ ui_locale })`
   from +layout.svelte); plus a `locale_changed` track event (from→to) in
   `change-locale.ts` for switcher-discovery insight.

## Decisions (Jacob-confirmed)
- `log_daily_sessions` rollup gained `visitor_id`, `browser_locale`, `ui_locale`
  (migration `20260724_log_daily_sessions_locales.sql`) → panels count TRUE
  unique visitors (visitor_id, session_id fallback pre-rollout).
- Analytics cache is **stale-while-revalidate** (`get_log_analytics`): fresh <15min,
  serve-stale + background refresh up to 48h, inline compute past that. Header
  shows "data computed X ago (cached; refreshes in the background)".
- Panel ("Languages") rides the `usage` scope on /admin/analytics: browser
  preference (✳/amber = unsupported) vs language-in-use, plus the
  supported-but-unused mismatch callout + chart. Admin sessions excluded.
- Locale folding: `fold_locale` — published-locale aliases win (zh-Hant→zh-TW),
  else bare language subtag (pt-BR→pt).

## Follow-up
- **horse cron `c-c77aec`** (one-time, 2026-08-25 09:00): analyze a month of
  prod locale data, cross-reference the AI-confidence tiers (chat report
  2026-07-24: Confident = it/pl/cs/uk/tr/ja/ko/fa/nl/sv/no/da/fi/el/ro/af;
  Decent = fil/th/ur/ne/hu/et/sk/sl/bg/sh/eu/ta/te/ml/kn/ka/az/kk;
  Low = my/lo/km/tpi/bi/tn/wo/mni/sat/gn), propose locales to add to Jacob.

## All tasks completed ✅
ingest column + retrofit (logs.db + archive auto-ALTER via CLIENT_LOG_COLUMNS) ·
endpoint stamp · client ui_locale · locale_changed event (added to
ALL_TRACKED_EVENTS) · shared.db migration + Drizzle schema · retention-cron
rollup · WindowSession + query_window_sessions extended · build_locales +
LocaleAnalytics · AnalyticsView panel (verified via svelte-look, light+dark) ·
SWR cache · mocks (mock-analytics, insights.test) · tests (95 in touched files;
full suite 1953 green) · tsc/lint/check green · dev smoke test (curl with
Accept-Language → row stamped pl-PL).

Note: tracking populates from the deploy onward — no backdating (Accept-Language
was never stored). Country geo remains the historical proxy.
