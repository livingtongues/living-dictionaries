# Analytics stale-while-revalidate parity — ✅ DONE (2026-07-24)

Port Living Dictionaries' analytics cache behavior to House and Tutor:

- [x] House: after 15 minutes, serve the last successful analytics/base cache entry stale at any age.
- [x] House: deduplicate background refreshes, preserve fresh pipeline/host/storage overlays, and update dashboard cache-age labels.
- [x] Tutor: after 15 minutes, serve the last successful analytics cache entry stale at any age.
- [x] Tutor: deduplicate background refreshes, preserve fresh pipeline/host/deploy overlays, and update dashboard cache-age labels.
- [x] Keep cache invalidation safe when Tutor's business-context endpoint clears analytics.
- [x] Update architecture text made stale by the cache change.
- [x] Verify focused tests, Svelte analysis, type checks, lint, and dashboard stories in both repos.

Source behavior: Living Dictionaries `site/src/lib/db/server/log-analytics.ts`
(`ANALYTICS_CACHE_TTL_MS = 15m`, with no maximum stale age).

Progress:

- Focused analytics suites: House 44/44, Tutor 45/45.
- Svelte analyzer: all four touched dashboard views clean.
- Svelte-look: House + Tutor analytics/health Default stories render correctly in
  light and dark; cache-age copy fits the existing headers.
- Full suites: House 2,051 passed (plus 2 expected failures and 3 skipped);
  Tutor 2,847 passed (plus 8 skipped).
- Both repos: TypeScript, lint, and `svelte-check` pass with no errors.
- Small unrelated cleanup: removed stale Tutor health CSS selectors left behind
  by the retired error-clusters table.
- Workspace note: a concurrent Cursor session committed and pushed the exact
  House diff to `main` as `91d78c1`; Tutor remains uncommitted.
- Follow-up decision: the last successful in-memory snapshot remains usable
  indefinitely; cache misses after a process restart still compute inline.
- Follow-up focused suites: Living Dictionaries 39/39, House 44/44, Tutor 45/45.
- The no-maximum-age correction is not committed in House or Tutor; Living
  Dictionaries has concurrent staged/working changes, so preserve its current
  index state when committing.
