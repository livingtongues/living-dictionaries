# Overnight brief 2026-07-03 — remaining approved items

Fresh LD writer executing the REMAINING approved items after session 4162dd7e
landed X1 + L8 (deploy-day errors fold + API-v1 activity panel) in commit 0d0c022a.

## Status of the 11 items
- [x] X1 — Deploy-day errors fold — **ALREADY DONE** (0d0c022a, `DailyPoint.stale_errors`)
- [x] L8 — API-v1 activity panel — **ALREADY DONE** (0d0c022a, `build_api_v1_activity`)
- [x] RS1 — ✅ Ported `build_server_faults` + `SCHEMA_DRIFT_PATTERN` → LD `log-analytics.ts` (`ServerFaults`/`ServerFaultCluster`, `server_faults` on `LogAnalytics`). Drift matched against message + stack head (LD labels its server errors, so SqliteError text lives in `stack`). Added "Server faults" panel on `/admin/analytics` (stat pair + clusters table, drift row highlight + tag). Tests added; inline snapshot updated; mocks patched (stories + insights.test). tsc clean; svelte-look verified light+dark.
- [x] N1 — ✅ Remove literal NUL bytes from `i18n/export.ts` → `const KEY_SEP = '\0'`; file now reads as UTF-8 text. Test green.
- [x] N2 — ✅ Pre-stage attachment R2 uploads BEFORE the durable thread insert in `send_to_one()`; on upload failure return a per-recipient `failed` result (null thread) — no orphan pending row. Split `persist_attachments` → `upload_attachments` + `insert_attachment_rows`. Added mockRejectedValueOnce test (18 pass).
- [x] B3 — ✅ Updated `.cron/invoice-2026-07-24.md` STEP 3: dropped deleted `svelte-5-migration` branch, now checks `main` only.
- [x] N3 — ✅ Rewrote `Button.svelte` `<style>` as readable scoped rules: resolved all `--un-*` cruft to concrete values (`--btn-ring` focus color + `--btn-shadow` resting shadow custom props), renamed the hashed `sp-*` classes → `btn`/`external-icon`/`spinner`, dropped `:global`. Same classes/props/behavior; equal-specificity source-order preserved so every hover cascade matches. Added `Button.stories.ts` (18 stories) pinning the matrix; svelte-look before/after = pixel-identical in light + dark. lint clean.
- [x] N6 — ✅ Retired compiled duplicates where TS sources exist: repointed `ui/Modal`, `ui/Slideover`, `functions/Menu` from the compiled `actions/portal.js` + `ui/trapFocus.js` to the root `portal.ts` / `trapFocus.ts` (verified byte-equivalent logic — only types/comments differ), then `git rm`'d `actions/portal.{js,d.ts}`, `ui/trapFocus.{js,d.ts}`, `actions/longpress.d.ts` (redundant next to `longpress.ts`), and dead `stores/clean-object.{js,d.ts}` (zero importers). tsc 0 / svelte-check 0 errors; Modal renders + portals correctly (svelte-look). Left legit no-TS-source `.js` (clickoutside/detectUrl/loadOnce/persisted-store/query-param-store) in place — out of NB1/N6 scope.
- [x] NB1 — ✅ Additive convergence of `.tw-prose` toward house `article-prose.css`: link `:hover` + `text-underline-offset`, `overflow-wrap: break-word`, explicit `em` italic, cross-browser `smallcaps`. Kept the `:where()`/em-spacing structure deliberately (documented in header) — a plain-selector rewrite would risk regressions on 5 live pages for no gain. svelte-look verified light+dark. (Caught + fixed an N6 over-deletion here: `clean-object.js` is imported by `query-param-store.svelte.js` — restored.)
- [x] NB2 — ✅ Documented both behaviors in `.knowledge/api/v1-write-api.md` "Gotchas": (1) `import_id` creates its batch tag even for an EMPTY entries batch (ensure_import_tag runs before the loop, guarded only by truthy import_id); (2) `sentence_order` is all-or-nothing — omitted sentence ids keep old sort_keys and interleave unpredictably against the freshly-minted `initial_keys`, so pass the COMPLETE ordered id list.
- [~] PB3 — DEFERRED for review. Largest/riskiest item (splits the ~1050-line live admin dash) and architecturally divergent from house (LD loads analytics via an API endpoint + universal `+page.ts`, not house's `+page.server.ts`). Originated as a DEFER/"watch until pages outgrow one screen" backlog item. Wrote a full ready-to-run plan (shared-builder approach, panel taxonomy, gating decisions) → `.issues/future/analytics-usage-health-split.md`. Recommend a checkpoint with Jacob before executing.

## DIRECTION (applies to 7-8)
Long-term svelte-pieces should DISSOLVE as a concept — pieces migrate to logical
homes (components/, utils/…) with cross-repo layout uniformity, NOT byte-identity.
Don't invest in svelte-pieces-as-a-bubble structure.

## Verification (2026-07-04)
- `pnpm test` — **175 files / 1194 tests pass** (+5: server_faults, compose attachment-orphan).
- `tsc --noEmit` — **0 errors**. `svelte-check --threshold error` — **0 errors** (37 pre-existing warnings).
- eslint clean on all touched files (only pre-existing `eqeqeq` warnings on the analytics page + log-analytics remain).
- svelte-look: analytics Server-faults panel (light+dark), Button matrix before/after = pixel-identical (light+dark), Modal portals correctly after the N6 repoint, tw-prose renders (light+dark).

## Untouched (another task's WIP)
Pre-existing dirty files left alone: `chat/notification-messages.ts`, `api/auth/email/verify`,
`api/auth/google`, `api/dictionaries/create`, `api/email/invite`, `.issues/system-notification-user-links.md`.

## Rules
NEVER commit or push. Verify per repo norms (vitest, lint, check, svelte-look where rendered).
