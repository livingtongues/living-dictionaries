# Execute approved items from 2026-07-17 reports — ✅ DONE (uncommitted)

Sources: `.cron/log-reviews/2026-07-17.md`, horse `.cron/parity-reviews/2026-07-17.md`,
horse `.cron/business-reviews/living-dictionaries-2026-07-17.md`. All left UNCOMMITTED for review.

## 1. ✅ CSV export crash (P2) — `.issues/export-friendlyname-glosses-crash.md`
- ✅ `site/src/routes/[dictionaryId]/export/friendly-name.ts` → `entry.senses?.[0]?.glosses` (all 3 refs)
- ✅ Test: `friendlyName({ id: '1234', senses: [] }, 'e3j3jsi.wav')` → `'1234_.wav'`
- The companion issue file can be deleted once this commits.

## 2. ✅ Unified data-fallback for free-form i18n values (ps./psAbbrev./sd.)
- ✅ `$lib/i18n/index.ts`: `USER_DATA_SECTIONS = {ps, psAbbrev, sd}` — a key absent from the EN
  catalog is user data → returned raw (`fallback || item`) BEFORE any lookup, no missing-key
  report. Not a swallow: EN-catalog membership is the canonical/data boundary; canonical keys
  still translate + still report when genuinely broken.
- ✅ Inline tests: `ps.v-è` / `psAbbrev.v-isce` / `sd.Verbs; Motion; Pronouns` raw + unreported;
  no-fallback case returns the bare item (never the prefixed key); canonical `ps.n`/`sd.1` translate.
- ✅ Knowledge updated: `.knowledge/domain/parts-of-speech-i18n.md` (display-side section).
- Effect in prod: the ~800/day `i18n missing key: ps.*|sd.*` warns stop at the source; the
  /admin missing-translations worklist stops listing user data.

## 3. ✅ Analytics: entry-edits trend chart — UI vs Agent API
- ✅ `log-retention-cron.ts` `rollup_day`: new forever metric `api_entry_edits` (source='server'),
  bulk-weighted: `v1_entries_written` context `created + updated` (+1 per `v1_entry_updated` /
  `v1_entry_deleted`). UI side already rolls up as `event:entry_created`/`event:entry_deleted`.
- ✅ `log-analytics.ts`: `EntryEditChannels` + `build_entry_edit_channels` (usage tier) — rollup
  finalized days + live-tail raw scans, live wins per day, zero-filled window. Legacy rollup days
  without the metric fall back to `event:v1_*` row counts (undercounts bulk — better than 0).
- ✅ `AnalyticsView.svelte`: "Entry edits · UI vs Agent API" panel (ComboChart, UI=primary /
  API=#7c3aed) after the Agent API activity panel, with totals + an honesty note (UI in-place
  field edits aren't discrete events, so UI = creates + deletes).
- ✅ `mock-analytics.ts` transition-story mock; svelte-look verified light + dark.
- ✅ Tests: retention (weighted metric, non-entry ops excluded) + analytics (rollup/live merge,
  live-wins, legacy fallback, totals). Full-shape inline snapshot regenerated (`vitest -u`).
- PROD NOTE (optional backfill): after deploy, delete the `log_rollup_finalized_through` row in
  shared.db `db_metadata` and let the sweep run — it re-rolls all hot+archived days (≤60d) under
  current rules, seeding `api_entry_edits` history (v1 API only exists since ~07-02, so this
  recovers the WHOLE API-era history including the 4,728-entry rusitene day).

## 4. ✅ Portal convergence (parity sweep)
- ✅ `site/src/lib/utils/portal.ts`: house's typed/null-safe body (return annotation, `portal_el`,
  `parentElement?.`), LD doc-comment kept. Modal story (ModalEditableArray "open") svelte-look ✓.

## Verify — all green
- ✅ `pnpm check` (0 errors / 46 warnings = pre-existing baseline)
- ✅ `pnpm lint`
- ✅ `pnpm test` (1718 passed / 3 skipped)
- ✅ svelte-look: /routes/admin/analytics/+page Default (light+dark, new panel renders),
  ModalEditableArray open-modal story (portal intact)

Note: the working tree also carries the 07-17 parity sweep's own uncommitted changes
(prune/detect-url snake_case) plus other pre-existing dirty files — untouched by this task.
