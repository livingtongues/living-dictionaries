# Log-review fixes — 2026-07-04 action items

From `.cron/log-reviews/2026-07-04.md`. Quiet day — yesterday's whole list shipped and verified live.
Three genuinely-new bugs, all on `rhenic` on the current 06:07 build, from one contributor's rapid
edit+record session. **This file NEVER edits code on its own — these are approved-fix candidates.**

## Items — ALL DONE 2026-07-04 (verified: 1235 tests pass · tsc clean · check 0 errors · lint 0 new · svelte-look light+dark)

- [x] ✅ 🟠 **P2 — media-upload eager-destructure crash.** Fixed in `upload-audio.ts`,
  `upload-image.ts`, `upload-video.ts`: now `const { data, error } = await api_upload(…)`, guard on
  `error || !data` (surfacing `error.message` / a fallback), then read `data.presigned_upload_url`
  inside the else. The crash no longer swallows the upstream reason — a failed upload URL request now
  ships a real `console.error(error)` row + a user-facing error state instead of an unhandled throw.
  (image renamed its var to `upload` to avoid colliding with the later serving-url `data`.)

- [x] ✅ 🟡 **P3 — diagnosable FK-constraint push failures + poison-pill guard.** `process_dict_changes`
  is now a thin wrapper over `apply_dict_changes` (unchanged happy path). On a FK-constraint error it
  runs `identify_orphan_push_rows` (a throwaway `BEGIN…ROLLBACK` that re-applies the push +
  `PRAGMA foreign_key_check`), identifies which PUSHED rows dangle, retries with those `skip_keys`, and
  returns them in `response.skipped_orphans`. The `/changes` route logs a `dict_changes_orphans_skipped`
  **warn** with `{ dictionary_id, orphans: [{ table_name, id, parent_table }] }`. So one orphaned child
  can no longer 500/poison a client's whole sync — the rest of the batch lands, and the orphan is now
  fully diagnosable (and clears client-side when the parent's tombstone arrives). Recovery is
  best-effort: any probe/retry failure rethrows the ORIGINAL error (never masks a real fault). Tests:
  orphan-skip lands the good row + reports the orphan; non-FK errors still throw.

- [x] ✅ 🟡 **low — classify Safari `Event`-errors as noise.** Added `{"isTrusted":true}` + `Load failed`
  to `KNOWN_NOISE_PATTERNS` (`classify-error.ts`) with a test. Folded out of the real-error headline.

- [ ] ⚪ **watch (no code):** `effect_update_depth_exceeded` on the rhenic entry-edit page (1× 08:01) —
  a Svelte reactive loop; not reproducible from logs. Trace the offending `$effect`/`$derived` only if
  it recurs. Also watch `Internal Error` deploy-swap 500s (2 on current build). **Left as a watch.**

## Dashboard (Phase C)
- [x] ✅ 📊 **"Top missing i18n keys" panel** — SHIPPED. `build_missing_i18n_keys` in `log-analytics.ts`
  (`MissingI18nKeys`: total / distinct_keys / sessions + top-25 keys by distinct sessions, human-only,
  hot window; keyed on `context.i18n_key` w/ message-suffix fallback) + a "Missing translations" panel
  on `/admin/analytics` (stat pair + a Key/Locales/Sessions/Rows worklist table linking to
  `/translate`). Story mock (Default + Empty) + reader test (ranks by distinct sessions, dedupes keys,
  excludes bots) added; visually verified light + dark.

## Verified already shipped (no action — checked against current code + prod DB)
- ✅ OPFS `AccessHandle is closed` → `storage_lost` (warn + throttle) + `is_storage_lost_error` +
  worker self-heal reopen (`sync-failure-classify.ts`, `dict-instance.ts`). The 112 tuscarora `error`
  rows in-window are the PRE-fix loop (07-03 20:12→21:32); zero on the current build.
- ✅ `navigation` self-nav dedupe (`log_navigation` skips `from === to`) — **0 self-navs post-deploy**
  (was ~4k/day).
- ✅ `[google one-tap]` demoted to DEV-only `console.warn` (`User.svelte`) — **0 rows post-fix**.
- ✅ Worker log attribution (`session_id` threaded into worker telemetry).
- ✅ Stale `/api/admin/chat/*` → `/api/chat/*` comment fix (`20260702_initial.sql`).
- ✅ Dashboard: API-v1 activity panel, deploy-day errors fold, top-routes-by-distinct-sessions
  (07-03), **Server faults / schema-drift panel** (07-04, `eb26cc1b`).
- ✅ Diacritic-slug `Invalid redirect location` 500s — fixed 07-03 (`canonical-path.ts` encoding);
  last row 07-03 11:15.
