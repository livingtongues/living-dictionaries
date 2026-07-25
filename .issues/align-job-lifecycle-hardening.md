# Forced-alignment job lifecycle hardening

From the 2026-07-24 nightly review (Pass A should-fix + Pass B candidate **B1**). The M6 alignment
job runner (`.issues/auto-align-timings.md`, commit `bfcd4bd3`) inserts a durable `align_jobs` row
with `status = 'running'` and then fires execution as an unawaited in-process promise. Nothing
bounds that execution:

- `run_modal()` used an unbounded `fetch`.
- `spawn_json()` had no timer and no kill path.
- `run_auto_align()` polled every 2s with no deadline.
- A later request refuses any audio that has a `running` row → HTTP 409 forever.

So a deploy/restart between the INSERT and the terminal UPDATE, a stalled Modal request, or a hung
local subprocess wedges that audio permanently and the browser spins forever.

**Approved scope (B1 only).** No general queue framework, no injected-dependency refactor of
`request_align_job` (B2), no pronunciation-fallback redesign (B3) — only the narrow exports needed
to test the lifecycle.

## Plan

- [x] One service deadline in `$lib/constants.ts` (shared client+server, no server import in the
  browser bundle): `ALIGN_EXECUTION_DEADLINE_MS` (execution bound), `ALIGN_JOB_STALE_AFTER_MS`
  (= deadline + write/cleanup grace → a `running` row older than this is unowned),
  `ALIGN_POLL_DEADLINE_MS` (browser stops polling).
- [x] `align-runner.ts`: `AbortSignal.timeout()` on the Modal fetch (translate the abort into a
  readable "timed out after Ns" error); explicit timer in `spawn_json` that SIGKILLs the child and
  rejects. `run_alignment({ …, timeout_ms })` optional override for tests only.
- [x] `align-job.ts`: `expire_stale_align_jobs({ db, now })` — ONE atomic UPDATE marking every
  `running` row older than `ALIGN_JOB_STALE_AFTER_MS` as `failed`; returns the expired rows.
  `sweep_stale_align_jobs()` wraps it for the production path (global shared.db + one
  `align_job_expired` server log). Called at the top of `request_align_job` (before duplicate
  detection) and from `get_align_job` (so a polling browser sees a terminal state even if the
  owning process died). One active job per audio is preserved — `has_running_align_job()` still
  refuses a fresh `running` row.
- [x] `auto-align.ts`: stop polling at `ALIGN_POLL_DEADLINE_MS` with a retryable message
  (`timings.align_timed_out`, EN only per the i18n rule).
- [x] Lifecycle regression tests (`align-job.test.ts`, `align-runner.test.ts`): interruption
  recovery, per-audio duplicate law across the sweep, hung subprocess, hung remote fetch.

## Decisions / notes

- **No `(audio_id, status)` index.** align_jobs is capped by the daily rate limits (20/dict,
  200/site) and both queries are per-request, not hot-path. Revisit only if a query plan shows it.
- **No boot sweep.** Blue/green runs two containers against one `/data`, so "everything running at
  boot is dead" is not true here; the age-based sweep at request/poll time is uniformly safe and is
  what the review called sufficient.
- The terminal UPDATE in `execute_align_job` is by job id, so a late-but-successful run that was
  already expired still lands `done` — truthful, because the timings really were written.

## Verification (2026-07-25 — all green)

- [x] `pnpm test` — **1996 passed / 3 skipped**, including the new `align-job.test.ts` (interruption
  recovery, terminal rows untouched, idempotent sweep, per-audio duplicate law) and
  `align-runner.test.ts` (hung subprocess killed at the deadline, exit-code + success paths, remote
  aligner that never answers, remote aligner that hangs mid-body).
- [x] The tree-kill test was confirmed to FAIL against a plain `child.kill()` (nested
  `sh -c "sh -c 'sleep 30 # marker'; true"` leaves the marked grandchild alive) — a real regression
  test, not a tautology.
- [x] `tsc --noEmit`, `pnpm check` (0 errors), eslint clean on every touched file.
- [x] **Live endpoint smoke test** on dev: seeded one stale + one fresh `running` row and hit
  `GET /api/v1/dictionaries/dev/align-jobs/{id}` — stale came back `failed` with the retryable
  message, fresh stayed `running`, and one `align_job_expired` warn row landed in `logs.db` with the
  job details. Rows cleaned up afterwards.
