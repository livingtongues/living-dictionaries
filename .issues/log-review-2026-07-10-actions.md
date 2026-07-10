# Log review 2026-07-10 — action items ✅ COMPLETE

Source: `.cron/log-reviews/2026-07-10.md`. Decisions from Jacob:
- **Standing dashboard directive**: plain language + at-a-glance visuals over error lists/jargon.
  Focus: user numbers, UX, where the site is used well, pain points, action steps, what to be aware
  of. Recorded permanently at the top of `.issues/future/dashboard-improvements.md`.
- Ship the cold/warm boot panel NOW with a friendly empty state (data flows after deploy).
- Star fix at the component level (NOT generic ON CONFLICT — dict-client insert deliberately
  collides loudly; v1 path already idempotent via `star_entry`).

## Tasks — all done

- ✅ **P3 star-toggle idempotency** — `entry/[entryId]/+page.svelte` `toggle_star`: in-flight guard
  + optimistic `star_row_id` from insert result / cleared on delete.
- ✅ **B2 featured analytics** — `ENTRY_FEATURED`/`ENTRY_UNFEATURED` in `log-events.ts` +
  `ALL_TRACKED_EVENTS`; tracked in `toggle_star`.
- ✅ **B1 dict_boot timing** — `report_dict_boot` (worker-safe, in `report-dict-sync-failure.ts`)
  emitted from `dict-instance.ts` on FIRST successful `open_and_wire` (stage marks accumulate across
  a seq-transition rebuild so duration = what the user waited; reopen/reset never re-emit).
  `context = { name:'dict_boot', duration_ms, cold, storage, snapshot_bytes, stage_ms, session_id }`.
- ✅ **Phase C reader** — `build_dict_boot` → `DictBootPerf` (+ `dict_boot` added to `PERF_METRICS`
  and PERF_LABELS); `nav_sections` (entering_dictionary / within_dictionary / other) in
  `build_performance`. Both under `analytics.performance`.
- ✅ **Panels** — "Opening a dictionary" panel on `/admin/health` (cold vs warm stat pair + typical
  download size + trend + slowest-first by-dictionary table + collecting empty state); nav-sections
  table in Performance; split line on the speed nav card.
- ✅ **Phase D thin-data guard** — `THIN_SAMPLE_N`/`is_thin_sample` in `dashboard-format.ts`;
  applied across perf summary, speed cards, all route/nav/LCP/boot tables with a shared footnote.
- ✅ **"At a glance" strip** — `$lib/analytics/at-a-glance.ts` (`build_glance`, unit-tested) +
  `AtAGlance.svelte` on BOTH `/admin/analytics` + `/admin/health` (humans audience only).
- ✅ Backlog + review files updated; mocks (`mock-analytics.ts`) + inline snapshot updated.

## Verification done
- `pnpm vitest` full suite 1488 passed; `tsc` + `pnpm check` + `pnpm lint` clean.
- svelte-look screenshots: health (populated/empty/bots, light+dark) + analytics — all render.
- E2E (headless puppeteer + dev server): cold boot row (497ms, snapshot_bytes 1556480, stage_ms) +
  warm boot row (270ms, cold:false) landed in `.data/logs.db`; star triple-click = ONE toggle, zero
  UNIQUE errors, `entry_featured`/`entry_unfeatured` events landed.

## Lessons / notes
- The pre-existing `UNIQUE constraint failed` row in local logs.db is dated 2026-07-04 (the original
  bug); don't mistake it for a fresh failure when re-verifying.
- `dict_boot` rows carry no `url` (worker fetch), so per-dictionary attribution uses `context.dict_id`
  joined to the shared.db catalog for display names.
- Warm-boot e2e recipe: same browser profile + `page.reload()` re-elects a leader against the
  existing OPFS file.
