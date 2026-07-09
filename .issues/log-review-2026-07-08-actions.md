# Approved actions from 2026-07-08 log reviews + nightly review Pass B

Executing the approved batch (sources: `.cron/log-reviews/2026-07-08.md` runs 1+2, horse
`.cron/nightly-reviews/2026-07-08.md` Pass B). Leave everything UNCOMMITTED.

## Items

- [x] 1. 🔴 Google canonical-email/admin-demotion fix (port house behavior)
  - `api/auth/google/+server.ts`: on re-login refresh ONLY avatar_url (never email/name);
    sign JWT from resolved `user.email`/`user.name`, not the raw Google profile.
  - Add `api/auth/google/server.test.ts` regression: allow-listed primary email + Google
    login w/ different verified email → primary email, admin level, JWT claims stay canonical.
- [x] 2. 🔑 sync_failed level by cause — findings: current code ALREADY levels by cause
  (`sync-failure-classify.ts`: client_behind/schema_outdated → warn). The error-level storm
  rows were kind `other` from the `dictionary not found` 404 (fatal). Change: add a
  distinct `not_found` kind (status 404) → error level, non-transient (repeat-tracker
  halts after 3, so no infinite error storm on current builds). Tests.
- [x] 3. File `.issues/stale-client-sync-storm-2026-07-08.md` (Greg + marlene stuck 9h+ on
  07-03 build; SW not self-updating; open Q: force hard reload after N schema_outdated
  blocks in `decide_client_behind_recovery`). Fold in the two tail code-audits from the
  old log-review issue.
- [x] 4. /og robustness: try/catch in `og/+server.ts`, text-only fallback card (never 500),
  `og_render_failed` warn w/ reason; fix mislabeled `og_font_unsupported` in
  `component-to-png.ts` (classify reason image_fetch|font|render).
- [x] 5. `remote-log.ts`: DOM `Event` values → extract `type` + `target.tagName` +
  `target.src|href` instead of `{"isTrusted":true}`. Test.
- [x] 6. Guard unguarded `glossingLanguages[bcp].vernacularName` in
  `[dictionaryId]/synopsis/+page.svelte` (SSR 500, grew 2→6).
- [x] 7. create-dictionary slug validation: clean pasted URL-like input
  (`httpslivingdictionari` case) in `convert-to-friendly-url.ts`; emit
  `log_event({ level:'warn', message:'dict_slug_suspicious' })` when detected.
- [x] 8. Build-adoption health strip: `build_build_adoption` in `log-analytics.ts`
  (GROUP BY app_version over session_start, build epoch → age bucket: current / behind
  (<3d) / stale (≥3d) / unknown) + "N% of active sessions can't receive fixes" headline +
  named-user detail. Panel goes on `/admin/health` (HealthView — where errors-by-version /
  sync-health diagnostics live; the report said /admin/analytics but diagnostics were split
  to /admin/health). Test + mock-analytics.
- [x] 9. Storage/WAL health strip: port tutor's `build_storage` (shared.db / logs.db /
  logs-archive.db + `dictionaries/*.db` aggregate, wal_ratio flag) + HealthView panel.
  Test + mock-analytics.
- [x] 10. Delete `.issues/log-review-2026-07-08.md` after folding tail audits into item 3.

## Verify
`pnpm test` (site), `pnpm check`, svelte-look screenshots for HealthView panels.
