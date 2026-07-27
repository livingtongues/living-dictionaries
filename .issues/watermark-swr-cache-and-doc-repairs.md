# July 25 morning-debrief items (LD)

Three approved items from the 2026-07-25 debrief. Sources:

- `~/code/horse/.cron/parity-reviews/2026-07-25.md` (Option A — extract the analytics
  stale-while-revalidate controller, app-local, one behavioral contract)
- `~/code/horse/.cron/loop-reviews/2026-07-25.md` (schedule-doc defect in `.cron/index.md`)
- `.cron/log-reviews/2026-07-25.md` (context: the analytics-compute observability work that
  shipped as `10aacd6c` — the cache boundary this touches)

Constraints: sole LD writer, preserve unrelated worktree changes (active import/API lane),
leave everything uncommitted.

## 1. `WatermarkSwrCache` — app-local controller + behavioral contract

Today `src/lib/db/server/log-analytics.ts` hand-rolls the cache: `analytics_cache` Map +
`analytics_revalidating` **Set** + `schedule_analytics_revalidation()`. Versus tutor/house it is
missing **tokenized single-flight** and a **generation-safe `clear()`** (an invalidated in-flight
refresh can repopulate a cleared cache).

- ✅ Add `site/src/lib/server/watermark-swr-cache.ts` — `WatermarkSwrCache<T>` with
  `get_or_schedule({ key, compute, project })` + `clear()`; instance options
  `read_watermark` / `on_background_error` / `schedule` (test seam, defaults to
  `setTimeout(run, 0)`). Owns entries, per-key symbol tokens, generation guard, watermark
  comparison, next-tick scheduling. Knows nothing about analytics payloads or `Database`.
- ✅ Rewire `log-analytics.ts` onto it, preserving LD specifics:
  - cache key `${days}:${audience}:${scope}`
  - cacheability rule (any injected `shared_db`/`logs_db`/`archive_db`/`now`/
    `current_app_version`/`bot_ua_min_per_day` bypasses the cache)
  - archive-db input (`get_log_archive_db()` on the background path)
  - the fresh `pipeline` liveness projection spliced onto hits ONLY
  - `on_computed` fires on request-path uncached computes only (never background — the
    endpoint closure carries `auth.user_id`)
  - `console.error('[log-analytics] background revalidation failed:', …)` logging
- ✅ Export `clear_log_analytics_cache()` (parity with tutor/house).
- ✅ Behavioral tests `site/src/lib/server/watermark-swr-cache.test.ts`: cold miss, fresh hit,
  stale immediate hit, concurrent single-flight, failed refresh retaining the last good value,
  clear-during-refresh not repopulating, independent keys not blocking each other (+ projector
  applies to hits only).
- ✅ Wiring tests `site/src/lib/db/server/log-analytics-cache.test.ts` (temp `DATA_DIR`):
  default-arg caching + single `on_computed`, stale-then-refresh with live pipeline projection,
  injected-db bypass, generation-safe clear.

## 2. `.cron/index.md` schedule doc

- ✅ `fill-translations` row said `every: 0 6 * * 1` (Mon 06:00 machine-local); the executable
  `.cron/fill-translations.md` says `0 22 * * 1`. Documentation-only fix →
  `weekly every: 0 22 * * 1 (Mon 22:00 UTC = Tue 06:00 MYT)`. Executable cron untouched.

## 3. `scripts/README.md`

- ✅ Replaced the 2-line esno/tsm stub with a compact executable/risk map: working directory +
  install (`pnpm install --ignore-workspace`, not a workspace member), environment
  (`DATA_DIR` local vs `/data` in the prod container), mutability per executable, the `DRY=1`
  dry-run convention, canonical invocation, verification. Historical one-offs listed as history,
  not as maintained tooling.
- ✅ `scripts/package.json`: added only recurring supported aliases (`sqlite-query`, `typecheck`)
  alongside the existing `test`. Both were run to confirm they work before documenting them.
- ✅ Removed the leftover EMPTY `scripts/media-migration/` directory (its files were deleted in
  `bfcd4bd3` when the R2 media migration completed; untracked, so it was only local noise).

## 4. Knowledge

- ✅ `.knowledge/admin/analytics-telemetry.md` — new section recording the copied-controller
  decision (three app-local copies, one behavioral contract, port fixes by hand) and the four
  invariants a naive edit breaks silently (generation-safe clear, tokenized single-flight,
  hit-only projection, silent background pass).

## Verification

- ✅ `pnpm --filter=site test --run src/lib/server/watermark-swr-cache.test.ts src/lib/db/server/log-analytics-cache.test.ts src/lib/db/server/log-analytics.test.ts src/routes/api/admin/analytics/server.test.ts`
- ✅ root `pnpm check` (svelte-check) — 0 errors
- ✅ root `pnpm lint`
- ✅ full `pnpm test --run`
- ✅ `scripts/`: `pnpm test --run` + `pnpm typecheck`

## Notes / lessons

- `get_logs_db()` returns an in-memory DB under `VITEST`, but `get_shared_db()` /
  `get_log_archive_db()` are DATA_DIR files — a cache test that exercises the DEFAULT-arg path
  must set `process.env.DATA_DIR` to a temp dir **before the first call** (LD has no
  `close_shared_dbs()` helper like tutor; vitest per-file module isolation makes that enough).
- The controller re-reads the watermark **before** each background compute (the old code read it
  after) — a watermark that advances during a long compute now leaves the entry stale instead of
  falsely marking it current.
- Root `pnpm lint` catches two things `pnpm check` doesn't in new files: `@stylistic/arrow-parens`
  (a single arg with a braced body needs parens) and `no-empty-function` (a `() => {}` test stub —
  collect into an array and assert on it instead).
- Unrelated worktree changes (the active import/API-v1 lane, `.cron/` model swaps, the deleted
  `2026-07-18` log review) were left untouched; nothing was committed.

## 5. Cross-repo convergence close-out (2026-07-27)

The three copies are now **byte-identical**: `watermark-swr-cache.test.ts` md5 matches in
house/LD/tutor, and `watermark-swr-cache.ts` differs only in the app-name token on line 3
(`house:` / `LD:` / `tutor:`) — verified by direct diff, not by assertion.

- ✅ The union suite earned itself twice: two independent `clear()` defects, each caught by a
  DIFFERENT app's pre-existing test — (a) an in-flight refresh whose generation was captured at RUN
  time instead of SCHEDULE time repopulated a cleared cache (found in LD, missing in tutor until
  patched); (b) with persistence attached, `clear()` left the durable copy on disk so the next read
  served the invalidated payload straight back (found in tutor). Fixes + tests in all three.
- ✅ **`settle()` now has direct coverage** (the last open item from the house lane). Two tests, 25
  total in the union suite:
  - *waits for a compute in flight, including one a scheduled refresh just started* — a manually
    released promise proves `settle()` is still pending while the refresh runs, and the refreshed
    value is visible after. Sabotaging `settle()` to `await Promise.resolve()` makes it FAIL, so it
    genuinely pins the seam `await_pending_analytics_computes` / `warm_analytics_caches` rest on.
  - *resolves when nothing is in flight and never rejects on a failed compute* — `allSettled`
    semantics, plus the rule that a caller-initiated `refresh_async` owns its own rejection
    (`on_background_error` stays empty).
  - Documented in the test what `settle()` deliberately does NOT cover: work that is merely
    SCHEDULED has not started, so a caller must let the scheduler run first.
- ⚠️ **Lint style for new tests in this file** (bit us twice now). Beyond the `require-await` /
  `no-empty-function` rules already noted: `vitest/prefer-to-be-falsy` + `prefer-to-be-truthy` reject
  `expect(flag).toBe(false/true)`. Since our own convention prefers precise matchers over
  `toBeFalsy()`, assert on an **order log** (`expect(order).toEqual(['released', 'settled'])`)
  instead of a boolean flag — satisfies both rules.
