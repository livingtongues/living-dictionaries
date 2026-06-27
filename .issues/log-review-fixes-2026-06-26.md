# Action items from the 2026-06-26 log review

Implementing the recommendations from `.cron/log-reviews/2026-06-26.md` (all except "re-run after
cutover" and the no-WebGL homepage fallback UI).

## Tasks
- [x] **Dict-route SSR errors → telemetry.** Added `handleError` to `hooks.server.ts` → captures the
  real stack + route + status for ALL SSR load/render failures via `log_server_event` (5xx→crash,
  404→info, else warn). Client path already captures via patched `console.error`.
- [x] **Error-page status→level** in `+error.svelte`: 5xx→crash, 401/403→warn, 404→info, else error.
- [x] **Exclude bots from usage/engagement/geo** in `log-analytics.ts` (hot, via registered
  `is_bot_ua` SQLite fn + `HUMAN_ROWS_SQL` on daily/events/routes/source/users/perf/ttfb/web_vitals +
  bot-skip-first in the session loop) AND `log-retention-cron.ts` (cold rollup skips bot rows).
  Server rows (NULL UA) always kept. Capability panel keeps its separate `bot_sessions` count.
- [x] **Verify `audio_played` wired** — ✅ fires on click + longpress in `entries/components/Audio.svelte:56`.
- [x] **Verify web vitals fire** — ✅ Puppeteer against live `/about`: FCP + TTFB land. Prod zero was
  fast headless sessions racing the 5s flush (LCP/CLS/INP only finalize on real hide/interaction).
- [x] **Surface web vitals on the dashboard** — reader now aggregates `web_vitals` (p50/p75/p95 by
  metric, human-only); new Core Web Vitals panel grades p75 vs CWV thresholds + a headless-only
  empty-state hint.
- [x] **WebGL: clean "user can't see map" error.** `Map.svelte` now try/catches `new mapboxgl.Map()`
  → one clean `log_event({ level:'error', message:'Map failed to load (WebGL unavailable)' })`,
  suppressing the raw Mapbox-internal stack. Non-fatal map `error` events aren't logged today (no
  homepage consumer), so nothing else to filter.
- [x] **Fix stale `prod-db.md`** — already resolved: the standalone doc was folded into the
  `database` + `check-logs` skills (both correctly use `sveltekit_blue` + `/data/shared.db`).
- [x] Tests: bot-exclusion (hot + rollup) added & green. `pnpm test` (my files 14/14), `check` (0
  errors), `eslint` (0 errors). Full suite green EXCEPT a pre-existing stale test from another
  agent's Anna-offboard task (see note).

## Heads-up (NOT my regression)
`src/lib/agent/triage/apply-triage.ts` inline test `'high-confidence account → Anna'` fails because
the in-progress **Anna-offboard** task (`.issues/legal-live-and-anna-offboard.md`) changed
`routing.ts` `account`→Jacob (uncommitted, with `admins.ts`) but didn't update that stale inline
test. **Proven independent of my changes** (stashing only my files keeps the failure). My added test
content merely shifted vitest scheduling so the inline source test ran in the full-suite pass. Owner
of the Anna-offboard task should update the test to expect Jacob.

## Notes
- `log_server_event` lives at `$lib/server/log-server-event.ts` (server-only). `handleError` in
  hooks.server.ts can import it.
- Existing analytics/retention tests use `user_agent: null` → kept by the predicate → stay green.
