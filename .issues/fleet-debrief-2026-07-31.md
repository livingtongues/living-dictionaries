# Fleet debrief 2026-07-31 — three approved fixes

Three items approved in the morning debrief of the 2026-07-30 fleet reports. All work in
living-dictionaries only (house + tutor carry siblings of #1 and #2; other workers own those).
Leave UNCOMMITTED — Jacob reviews and commits.

## 1. Port house's fixed pre-commit hook ✅

`.githooks/pre-commit` ends with:

```sh
git diff --cached --name-only --diff-filter=d | xargs -r git add
```

The comment above it ("re-stage only files that were already staged") is FALSE. `git add <path>`
stages the WHOLE working-tree file, not the hunks that were staged. It runs AFTER the tests and
typecheck, where nothing is watching.

It cost house two bad commits on 07-30: `173fbb4b` carried another lane's in-flight
`hooks.server.ts` (import of a still-untracked module → `main` unbuildable until that lane pushed),
and `6f9d0f58` swallowed three paragraphs of another agent's AGENTS.md.

**The property to port** (house commit `93a43156`) — not "a better git add":
- Record which staged files are BYTE-IDENTICAL in index and worktree BEFORE the formatter runs.
- Re-stage ONLY those.
- PRINT the ones deliberately skipped.
It is a refusal to stage anything whose working-tree copy it did not already own.

LD is specifically exposed: the Monday translation lane exists to leave an uncommitted seed-file diff.

Gotcha from house's commit message: `printf '%s'` (no `\n`) drops the last path, silently skipping
every single-file commit's lint fixes. Must be `printf '%s\n'`.

## 2. The analytics-snapshot child can wedge itself permanently ✅

`site/src/lib/db/server/analytics-snapshot.ts` — `spawn_analytics_snapshot_job`.

`set_running({...})` is cleared only in `child.on('exit')`. Node delivers `'error'` WITHOUT
`'exit'` when the child fails to LAUNCH (verified empirically by the nightly lane: an unlaunchable
child fires `error` with `ENOENT` and no `exit`). The `'error'` handler only `console.error`s. So
after one launch failure the in-flight guard stays set for the life of the container and the daily
03:30 computation, the boot catch-up AND `/admin/analytics`'s Recompute button all answer
`already-running` forever. Most likely under memory/process pressure — exactly when the dashboards
matter.

Fix: clear the flag on `'error'` too, and make error+exit unable to double-clear (a later job's
guard must not be cleared by an earlier child's late event). Add a regression test simulating a
launch failure.

## 3. Make the reload-once rule permanent ✅

Source: `.cron/log-reviews/2026-07-30.md` §1 P2.

On 07-29, 22:29–22:35 UTC a SIGNED-IN contributor opened the private `algonquin` dictionary. The
leader worker's `await import('../dict-instance')` asked for
`/_app/immutable/workers/chunks/DASUsDk6.js` — a chunk a deploy had already deleted. Result in one
session: 39 `leader_boot_failed`, 14 `dict_boot_recovery_exhausted`, 1 `initial dict sync failed`,
and a six-minute lockout from her own dictionary.

The retry ladder is hopeless BY CONSTRUCTION: the artifact is gone from the server, so no number of
retries can succeed. Only loading the current build can help.

**Jacob approved this as a portfolio-wide rule**: when the missing thing is a build artifact the
server has deleted, retrying is provably useless — reload ONCE onto the current build instead of
retrying N times.

Implement here (this is where the rule was learned and where the harm happened):
- detect the deleted-build-artifact case,
- stop the retry loop (do NOT burn the ladder, do NOT re-elect),
- reload once onto the current build (same one-shot guard as `schema_outdated_reload`),
- emit telemetry for the TERMINAL outcome so it is measurable.

Also write the rule down durably (decisions.md / AGENTS.md / .knowledge) so it isn't re-derived.

Note: this deliberately narrows the standing 2026-07-09 decision ("no forced-reload mechanism will
be built" for stale-tab sync storms). That ruling is about forgotten background tabs belonging to
nobody's active work; this is a foreground tab, a signed-in editor, and a load that can NEVER
succeed. decisions.md must record the narrowing so a future lane doesn't revert it.

## Verification

`pnpm test`, `pnpm check`, `pnpm lint` before stopping.


---

# What landed

## 1 ✅ `.githooks/pre-commit`

Ported house `93a43156`'s PROPERTY, not just a tidier `git add`:
- `staged_clean` is captured BEFORE `pnpm lint:fix` — the staged files whose worktree copy is
  byte-identical to the index (`git diff --quiet -- <file>`).
- Only those are re-staged afterwards.
- Anything staged that also carries unstaged changes is PRINTED, never touched.
- `printf '%s\n'` (a bare `%s` drops the last path → single-file commits silently lose their lint
  fixes) and a trailing `exit 0` (the loops can end on a false test).

**Verified in a scratch git repo** (not just read): with a stub formatter,
- a single fully-staged file's formatter edit still lands in the index (the `%s\n` regression),
- a file staged then edited again in the worktree is committed EXACTLY as staged, its worktree edit
  survives intact, and it is reported as skipped.
Also `sh -n` clean. Side finding while testing: this logic must NOT be run under `set -e` — the
`staged_clean=$(...)` assignment legitimately exits non-zero when the last staged file is dirty. The
real hook has no `set -e`, and the final `exit 0` covers the same class.

## 2 ✅ `site/src/lib/db/server/analytics-snapshot.ts`

`spawn_analytics_snapshot_job` now releases the in-flight guard through a `settle()` helper called
from BOTH `error` and `exit`, latched by a `settled` boolean so it fires exactly once per child.
The `error` path also emits `analytics_snapshot_failed` with `spawn_error`, so a launch failure is
visible in `client_logs` instead of only in the container log.

Node's actual behaviour was confirmed by running it, not by reading docs:
`fork(path, [], { execPath: '/nonexistent/node-binary' })` → `EVENTS: ["error:ENOENT"]`, no `exit`.

Regression tests in `analytics-snapshot.test.ts`:
- **real `fork`**, deliberately unlaunchable → asserts node emits `error` and NOT `exit`, that the
  guard clears, and that the next job actually spawns.
- a late `exit` from an already-errored child must NOT clear a LATER job's guard.
Both **verified to FAIL against the pre-fix code** (reverted the source temporarily: 2 failed,
11 passed), then pass with the fix (13 passed).

## 3 ✅ The reload-once rule

New:
- `site/src/lib/db/client/stale-build-artifact.ts` — pure classifier + the rule's rationale +
  inline tests. `navigator.onLine === false` VETOES the classification (offline gives the same
  message but there the artifact may still exist, so retrying is plausible).
- `site/src/lib/db/dict-client/stale-bundle-recovery.ts` + `.test.ts` — one reload, foreground-only,
  own sessionStorage guard key, then a toast. Reuses `decide_client_behind_recovery`'s proven policy.

Changed:
- `worker/db-client.ts` — new INJECTED `boot_failure_terminal_reason` hook (the harness stays
  app-agnostic; house's `PARITY.md` test rejects unclassified files in that folder, so the
  classifier lives outside it). On a terminal reason: no retry, no re-election, resign the lock,
  report `will_retry: false` + `terminal_reason`. Also added the missing `spawned.onerror` handler —
  a worker whose SCRIPT 404s posted nothing at all, which was a silent permanent wedge — plus a
  `handled` latch so `error` + `boot_failed` can't double-count.
- `worker/instance.ts` — `BootFailure.terminal_reason`.
- `dict-session.ts` — wires the classifier, routes terminal failures to the recovery, and passes `t`
  through `open_dict` for the give-up toast (English fallback when absent).
- `worker/db-client.test.ts` (new) — fake `Worker` + fake timers prove ZERO respawns across 120 s for
  a terminal failure, that a genuinely retryable message still runs the ladder, and that a script
  load failure reports terminal instead of wedging.

Telemetry (all measurable, exactly one row per occurrence):
`stale_bundle_reload` (warn) · `stale_bundle_reload_deferred` (warn, hidden tab) ·
`stale_bundle_reload_gave_up` (error — a real person stuck behind the toast).

Written down in: `AGENTS.md` (new "The reload-once rule" section), `.cron/log-reviews/decisions.md`
(new standing decision + an explicit NARROWED note on the 2026-07-09 zombie-tab decline so a future
lane doesn't revert it), `.knowledge/db/leader-worker-boot-robustness.md` (the ladder now has an
exit; also flags what house has NOT yet mirrored), `.knowledge/admin/analytics-telemetry.md` (item 2),
`.knowledge/workflow/concurrent-agents.md` (item 1).

Drive-by (stale, unrelated to a lane): `.knowledge/db/*.md` referenced `dict-lifecycle.ts`, which is
now `dict-session.ts`.

## Verification

- `pnpm --filter=site exec vitest run` — **331 files, 2467 passed**, 1 skipped file / 4 skipped tests.
- `pnpm check` — 0 errors (46 pre-existing warnings).
- `pnpm lint` — clean.
- House parity is NOT broken: its `parity.test.ts` filters `.test.ts` out of the folder scan, and
  `db-client.ts` / `instance.ts` are both 🔴 divergent (existence-only).

Everything left UNCOMMITTED for Jacob.
