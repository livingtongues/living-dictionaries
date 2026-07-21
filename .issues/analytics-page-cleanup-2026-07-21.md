# Analytics page cleanup

Requested 2026-07-21:

- Remove the **Missing translations** panel from `/admin/analytics`.
- Move **Browsers & devices** immediately above **Geography**.
- Remove visible raw-log counts, including the headline total and log-based
  busiest-day summary.
- Remove the header's **Site health →** shortcut.
- Repair the **Experience** card, which lost its performance inputs when the
  analytics page was split into progressive `light` and `usage` payloads.

## Plan

- [x] ✅ Simplify and reorder the analytics page UI.
- [x] ✅ Include the Experience card's performance/Web Vitals inputs in the usage
  payload without pulling in the rest of the diagnostics tier.
- [x] ✅ Stop computing the removed missing-translation worklist for the usage tier.
- [x] ✅ Verify focused analytics tests, Svelte analysis/checks, and light/dark
  screenshots of the page stories.

## Implementation notes

- The Experience regression came from the progressive payload split: both the
  initial `light` response and its `usage` replacement carried typed-empty
  performance/Web Vitals sections. The usage scope now computes those two inputs
  while continuing to omit the rest of the diagnostics-only panels.
- The removed Missing translations worklist is now computed only by the legacy
  `full` scope, not by the `/admin/analytics` usage request.
- The human page now flows from Top dictionaries → Browsers & devices →
  Geography → Agent API activity. Bot analytics continue straight to Geography
  because the browser capability panel intentionally excludes bots.

## Verification ✅

- Focused analytics tests: 41/41 passed.
- Full Vitest suite: 1,757 passed, 3 skipped (241 files passed, 1 skipped).
- `pnpm check`: 0 errors (45 existing warnings).
- `pnpm lint`: passed.
- `tsc --noEmit`: passed.
- Svelte analyzer: no issues or suggestions.
- Svelte-look full-page screenshots inspected in light and dark; Experience is
  populated and the requested panel order/removals are visible in both themes.
