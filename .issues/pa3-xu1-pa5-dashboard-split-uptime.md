# PA3 + XU1 + PA5 — admin dashboard split, uptime panel, dead-file deletion

Three approved overnight-brief items. **Do NOT commit/push** — leave uncommitted for Jacob.

## PA3 · Split the combined admin analytics page into usage + health (mirror tutor)

tutor runs `/admin/analytics` (usage) + `/admin/health` (diagnostics), both fetching the SAME
`/api/admin/analytics` endpoint (same `LogAnalytics`), each rendering a subset of panels + cross-links.
LD still has ONE combined `/admin/analytics`. Split it the same way.

Shared helpers (mirror tutor):
- ✅ `src/lib/analytics/dashboard-format.ts` — pure format helpers + palettes (LD variant).
- ✅ `src/lib/analytics/mock-analytics.ts` — extracted story mock (+ `uptime`), shared by both stories files.

Page split:
- ✅ `/admin/analytics/+page.svelte` → USAGE: cards (Sessions/Users/Logs), headline, insights (4 usage),
  Traffic, Top routes, Top events, Geography (areas only), Agent API activity, Missing translations,
  Browsers & devices. Cross-link → Site health.
- ✅ `/admin/health/+page.svelte` (NEW) → DIAGNOSTICS: schema-drift, pipeline, error cards, Errors/day,
  Server faults, Boot health, Errors-by-version + Leader health, Performance, **Synthetic uptime (XU1b)**,
  Web Vitals, Geography TTFB, Event coverage, By source, Error clusters. Cross-link → Analytics.
- ✅ `/admin/health/+page.ts` (NEW) — same fetch as analytics.
- ✅ `/admin/health/_page.stories.ts` (NEW) + update `/admin/analytics/_page.stories.ts` to shared mock.
- ✅ admin `+layout.svelte` nav: add Health link (min_level 3). admin `+page.svelte`: add Health card.

## XU1 · uptime monitor (LD half)

- (a) ✅ ALREADY DONE in LD — `/api/log` `X-Log-Source-Secret`/`UPTIME_PROBE_SECRET` trusted path AND
  `uptime_probe` in `INFRA_EVENTS` already present (identical to house). No change needed.
- (b) Server: ✅ port `build_uptime` + `UptimeSummary`/`UptimeDailyPoint` + `uptime` field into
  `src/lib/db/server/log-analytics.ts` (from house). ✅ add unit test. ✅ Panel rendered on health page.

## PA5 · delete dead files (verified zero importers)
- ✅ `src/lib/helpers/example-sentences.ts`
- ✅ `src/lib/export/check-for-missing-keys-in-headers.ts`
- KEEP `api/email/html/new-user-welcome.ts` (Jacob handling welcome emails separately).

## Verify — ✅ all green
- ✅ `pnpm test run` — 1253 passed (incl. new uptime test); updated 1 inline snapshot + insights.test mock for `uptime`.
- ✅ `tsc --noEmit` clean.
- ✅ eslint on changed files — 0 errors (only pre-existing `!= null` eqeqeq warnings, matching the codebase idiom).
- ✅ `pnpm check` — 0 errors.
- ✅ svelte-look both pages, light + dark. Uptime panel confirmed ("99.9% availability · 4,032 probes · from mustang-my" + TTFB chart).

## Status: COMPLETE — uncommitted, ready for Jacob's review. Knowledge note added to
`.knowledge/admin/admin-backend.md`.
