# Implement 2026-06-27 log-review recommendations

Acting on the action items in `.cron/log-reviews/2026-06-27.md`. The `/log-and-fix` command is
read-only; this issue is the build follow-up Jacob green-lit ("you can do the recommendations").

## Status of each action item

- [x] ✅ **(Phase C, secondary) `page_load` percentile hygiene** — `log-analytics.ts`: perf query now
  filters `duration_ms > 0`; `PerfSummary.slowest = { duration_ms, route }` (via new `url_route`
  helper); perf panel renders a "slowest Ns · /route" row. Inline vitest for `url_route` (4 cases).
  Verified visually (slowest 15s · /example-dict/entries).
- [x] ✅ **(Phase C, primary) Deploy/version markers on the daily timeline** — `log-analytics.ts` adds
  `deploys` (first-seen day per `app_version`, hot window, human rows via `audience_filter`); page maps
  to `events` (chip label = `⬆ HH:MM` from the build epoch ms, note with version/first-seen/sessions)
  on the Traffic ComboChart + Errors LineChart. Verified visually (chips + dashed marker lines).
- [x] ✅ **(P3) WebGL async noise filter** — added `Failed to initialize WebGL` to
  `NOISE_MESSAGE_PATTERNS` in `remote-log.ts` (the async Mapbox-internal failure that escapes
  `Map.svelte`'s synchronous catch).

## Verification — DONE
- ✅ `pnpm exec vitest run src/lib/db/server/log-analytics.ts` — 4/4 pass
- ✅ `pnpm exec tsc --noEmit` — 0 errors
- ✅ `pnpm check` — 0 errors (20 pre-existing warnings)
- ✅ `pnpm exec eslint` (touched files) — 0 errors (pre-existing `eqeqeq` warnings only)
- ✅ svelte-look Default story — deploy markers on both charts + slowest-load row render correctly
- Also updated story fixtures (`_page.stories.ts`, `insights.test.ts`) for the new required fields.

## Already resolved in code (no action — verified this run)
- ✅ **SSR dict-load failure logging** — `hooks.server.ts` `handleError` already routes the real cause
  (route/status/stack, `source='server'`) to `log_server_event` (comment cites the 06-26 500s). The
  `[dictionaryId]/+layout.ts` catch's `console.error` is just belt-and-suspenders for client-nav.
- ✅ **WebGL graceful handling (synchronous)** — `Map.svelte` onMount catch logs one clean error +
  keeps the placeholder (no-fallback-UI by design).
- ✅ **`audio_played` wired** — `Audio.svelte:56`.
- ✅ **`+error.svelte` status→level map**, **error-cluster + known-noise panel**, **CWV panel**.

## Deferred to its own follow-up (broad, needs per-route judgment)
- **`api/*` failure-path `log_server_event`** — `handleError` already captures *thrown* errors during
  SSR/load, but endpoints that return `{ error }` / non-2xx JSON **without throwing** stay
  server-side-silent. A proper sweep (auth send-code/verify, sync `/changes`, uploads,
  email-inbound) needs per-route decisions on what's worth logging vs noise. Capture separately when
  there's real traffic to justify which paths matter.

## Verification
- `pnpm test` (new perf-hygiene unit test), `pnpm exec tsc`, `pnpm lint`, `pnpm check`.
- svelte-look story for the analytics perf panel + timeline (deploy markers + slowest-load row).
