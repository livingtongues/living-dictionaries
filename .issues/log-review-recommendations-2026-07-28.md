# Implement 2026-07-28 log-review recommendations

Implement and verify the five approved recommendations from
`.cron/log-reviews/2026-07-28.md`.

## Work

- ✅ Diagnose the production `/og` failures: concurrent native `Resvg` calls inside one worker
  caused exclusive-reference failures and downstream render timeouts.
- ✅ Serialize worker-local rendering and add a concurrent-render regression test.
- ✅ Coalesce high-volume `/og` success, shed, and repeat-failure telemetry into minute summaries.
- ✅ Diagnose the Norsii audio failure and prepare a repair without mutating production.
  - The current dictionary row and public snapshot both point at a healthy R2 WAV.
  - The affected browser requested an obsolete pre-R2 path retained in its local database.
- ✅ Suppress only the expected browser `AbortError` caused by a pause/load racing `play()`.
- ✅ Add signed-in-client 5xx breadth and worst-hour evidence to the existing uptime panel.
- ✅ Run focused tests, TypeScript/Svelte checks, lint, production build, and light/dark visual
  verification.
- ✅ Record durable findings in the source report/issues and close out its action items.

## Verification

- 2,318 tests passed; 3 skipped.
- `svelte-check`: 0 errors.
- ESLint: clean.
- Production build: successful.
- `svelte-fix`: no issues or suggestions for `HealthView.svelte`.
- svelte-look: inspected the full `/admin/health` default story in light and dark themes.
