# Leader-worker boot robustness — the boot must never hard-cap a slow download

**The invariant (holds for all three apps):** the browser's local-first DB boot must
NEVER put a snapshot/DB **download under a fixed wall-clock timeout**. A 14 MB dict on a
slow connection legitimately takes >12 s; a fixed cap kills it, the leader never announces
`ready`, and (worse) a lone tab dead-ends. Distinguish *slow-but-progressing* from *hung*.

## The 2026-07-01 incident that forced this

A `river` manager (`eatb4running`) got `leader boot timed out after 12000ms` after: editing →
**deploying** (new hashed chunks + a new dict migration) → returning to the "older version,
hit reload" toast → reloading on a **poor connection**. Boot hung ~12 s repeatedly; only a
full tab **close** fixed it (a reload re-hit the same wedge). Server snapshot build was 358 ms
and R2 was fresh — so the stall was **client-side network** (a boot fetch — worker chunk /
wasm chunk / snapshot — stalling during the deploy window on a poor connection), killed by the
fixed 12 s watchdog. See `.issues/leader-worker-boot-hang-robustness.md`.

## The fix (LD `dict-client/worker/` + `dict-instance.ts` + `fetch-snapshot.ts`)

1. **Idle/no-progress boot watchdog** (`boot-recovery.ts` `create_boot_watchdog`). Replaces
   the fixed `with_boot_timeout(12s)` in `leader-worker.ts`. It fires ONLY after
   `BOOT_IDLE_TIMEOUT_MS` (20 s) with **no progress tick** — not a wall-clock cap. Zero ticks
   degrades to a plain 20 s cap (so a true `hang` is still caught; the synthetic wedge-harness
   fault still trips it).
2. **Progress ticks** via `InstanceContext.report_progress(stage)`. `dict-instance.ts` ticks at
   each stage (`probe`/`snapshot_fetch`/`opfs_open`/`migrate`/`engine_start`) and
   `fetch-snapshot.ts` **streams the response body** (`getReader()`) ticking **per chunk**. So a
   slow-but-progressing download resets the deadline forever; only a truly dead transfer (no bytes
   for 20 s) or a stuck OPFS handle trips it. This is Jacob's "abort only if zero bytes for ~20 s"
   — we do NOT abort a legit slow download.
   - **Why idle-watchdog and NOT house's background-download-and-swap:** LD dicts are **editable**.
     Announcing `ready` on an empty DB and swapping the snapshot in later would lose any writes an
     editor typed during the window. So LD keeps *awaiting* the download — just no longer under a
     hard cap.
3. **Single-tab auto-recovery** (`leader-election.ts` `reacquire()` + `db-client.ts`). After the
   fast in-tab boot retries are spent, the tab used to `resign()` and **dead-end forever** (a lone
   tab has no other waiter to promote; `open_dict()`'s `ready()` never resolved). Now it re-enters
   the election on a capped backoff (`reelect_delay`, 2→30 s), so a transient cause (deploy window,
   poor connection) **self-heals without a manual close**. `on_ready` cancels the backoff the moment
   any tab becomes a healthy leader. (The in-flight-query side was already covered — LD's
   `dict-live-db` uses `client/live/live-query-retry.ts`.)
4. **Boot telemetry** (`db-client.ts` `on_boot_failed` hook → `dict-session.ts`). Worker-internal
   errors NEVER reach the main-thread `console.error` patch, so boot failures were invisible in
   `client_logs` (why the incident was hard to diagnose). The hook logs `leader_boot_failed`
   `{ dict_id, boot_message, last_stage, attempt, will_retry }` — `last_stage` (from the progress
   ticks) points a stall at the exact phase.

## The ladder has an EXIT: the reload-once rule (2026-07-31)

The idle watchdog + retry ladder + re-election above all assume the failure is **transient**. One
class isn't: a boot failure caused by a **build artifact the deploy deleted**. `/_app/immutable/*` is
content-hashed, so a 404 there is permanent for that bundle and every retry is guaranteed to fail.

On 2026-07-29 a signed-in contributor opened the private `algonquin` dict from a pre-deploy tab; the
leader worker's `await import('../dict-instance')` chased a removed chunk through 39
`leader_boot_failed` → 14 `dict_boot_recovery_exhausted` → **six minutes locked out of her own
dictionary**. Nothing in the ladder could ever have succeeded.

So `db-client.ts` now takes an **injected** `boot_failure_terminal_reason` policy. When it returns a
reason the client skips the ladder AND the re-election entirely, resigns the lock (a tab already on
the current build can lead immediately) and reports `on_boot_failed({ will_retry: false,
terminal_reason })`. Non-obvious pieces, in order of how easily they'd be undone:

- **The policy is injected, not hard-coded.** `dict-client/worker/` is copy-paste-shared with house
  and house's `parity.test.ts` rejects unclassified files in that folder — so LD's classifier lives
  OUTSIDE it, at `$lib/db/client/stale-build-artifact.ts`. Don't "simplify" it back inside.
- **`navigator.onLine === false` vetoes the classification.** Offline produces the identical message,
  but there the artifact may well still exist — retrying is plausible, and a reload would trade a
  spinner for the browser's offline page.
- **`spawned.onerror` is now handled.** A worker whose SCRIPT itself 404s posts nothing at all: no
  `boot_failed`, no `ready`, lock still held. That was a silent permanent wedge, invisible in
  `client_logs`. It's terminal by construction (the URL is a hashed immutable chunk) — no message
  sniffing.
- **Hidden tabs are deferred, not reloaded.** Standing decision 2026-07-09 declined forced reloads
  for zombie background tabs; the recovery waits for `visibilitychange`, and only then spends its
  one-shot budget.
- **Terminal telemetry replaces `dict_boot_recovery_exhausted` for this class** — exactly one of
  `stale_bundle_reload` / `_deferred` / `_gave_up` per occurrence, so triage never double-counts and
  "did the rule rescue people?" is answerable. `_gave_up` means the reload did NOT pick up newer code
  (stale SW/CDN) and a real person is stuck behind a toast.

## The ladder also has a FLOOR: bounded × unbounded = unbounded (2026-08-03)

The reload-once rule above handles the class where retrying is *provably* useless. A second class had
nothing at all: a boot that keeps failing for a reason nobody can classify from the message — every
one of 2026-08-02's four failures was `sqlite3_open_v2` at stage `opfs_open`, i.e. the OPFS file
simply refuses to open.

The arithmetic that made it unbounded is the non-obvious part, and it is invisible reading either
file alone: `boot_retry_decision` bounds attempts **inside one worker** (0→1→2), then the tab resigns
and `reelect_delay` re-enters the election — and the NEW worker starts the ladder at zero. Bounded
retries × unbounded re-elections = unbounded. One anonymous iPhone on `tutelo-saponi` wrote **17
failure rows over nine and a half minutes**, opened a second session and hit the same wall — with
nothing on screen but an indeterminate progress bar, because `dict-boot-progress.svelte.ts` had
stages and no failed state.

Four pieces, all in `$lib/db/dict-client/`:

- **`boot-give-up.ts`** — `MAX_BOOT_REELECTIONS` (3) caps the OUTER loop, so the ladder ends in ~15 s
  instead of never. It also bounds the TELEMETRY (`decide_boot_failure_log`): a repeating failure
  says nothing new after a few rows, and the rows cost bandwidth on a device already in trouble (one
  tab once shipped **421** `dict_boot_recovery_exhausted` rows over five hours). Measured after: 12
  boot attempts → **6 rows** (3 warn + 2 terminal + 1 `dict_boot_gave_up`).
- **A real failure state** in `dict-boot-progress.svelte.ts` + `routes/DictBootProgress.svelte`,
  shown even when the progress bar never activated — a warm re-open never emits `snapshot_fetch`,
  which is the shape every one of these failures had.
- **`reset-dict-storage.ts`** — destroy the client FIRST (it holds the OPFS sync-access-handle, and a
  held handle makes `removeEntry` fail), delete the file, reload.
- **`boot-failure-context.ts`** — `navigator.storage.estimate()` + `persisted()` + visibility on
  every shipped failure row. "Is this device simply full?" had no answer before; now it is one query.

**The viewer/editor asymmetry is the load-bearing judgement** and it did not change, only widen:
`poisoned_file_recovery_decision` may silently drop and re-fetch a VIEWER's file (snapshot + server
pulls, losslessly re-downloadable) but never an EDITOR's, because an unopenable file cannot be probed
for un-pushed writes — that check lives inside the file. Editors get the same panel plus a warning
and a `confirm()`; the reset is theirs to authorize, never ours to take.

What DID widen: fresh-file failures (`file_existed === false`) used to be excluded on the reasoning
that a just-written snapshot cannot be poisoned. That reasoning has a hole — `drop_in_snapshot`
SWALLOWS a failed write and falls through to an empty DB, so a quota blip or truncated write leaves
exactly the half-file `sqlite3_open_v2` refuses. Viewers may now replace it too
(`viewer_replace_fresh`, named separately in telemetry so the branch's usefulness is measurable). The
once-per-page-session permit — carried across re-elections by `poison_recovery_attempted` — is what
prevents a refetch loop, NOT the `file_existed` test.

**house's `db-client.ts` still has the unbounded shape** (it is 🔴 divergent in `PARITY.md`, so LD
taking this first breaks no parity test). Port `boot_reelect_decision` when its boot triage comes up.

## Main-thread boot is non-blocking (2026-07-07)

The WORKER still awaits the download in the factory (above) — but the **main thread no longer
awaits the leader's `ready()`**. `open_dict` (`dict-session.ts`) returns the `DictConnection`
shim **immediately**; the dict `[dictionaryId]/+layout.ts` load no longer blocks, so navigating
into a dictionary (homepage "Open entry", entries list, the map "Open dictionary" popover) is
**instant** even on a cold first open. The shim's queries/execs queue in the transport and resolve
once the leader announces `ready`; the root-layout `DictBootProgress` bar streams the snapshot
download % over the already-rendered page.

Three things make instant nav SAFE (spread across files — connect them before touching this):
- **Entry page** (`entry/[entryId]/+page.ts`) has a "cold window" branch that server-fetches the
  single entry for immediate real content while the snapshot downloads.
- **Entries list** shows its `loading` spinner until `read_dict_bundle` resolves.
- **`entries-ui-store.ts` `load_bundle_with_retry`** retries on `code === 'timeout'` (its own
  6-attempt budget) — the first bundle read can fire mid-cold-boot and hit the transport's 20 s
  buffered-request timeout; without the retry a boot > 20 s would leave the Orama list empty.
  (The reactive `DictTableStore` queries already retried timeouts via `live-query-retry.ts`.)

Trade-off (accepted): a MemoryVFS fallback boot (pre-iOS-17, no OPFS snapshot) can flash an empty
entries list briefly before pull-since-null fills it — the old `await initial_sync` guard that hid
that is gone (`is_opfs_backed` is unknown until ready anyway, and awaiting it is what stalled nav).
The common OPFS path never flashes empty (queries queue → full snapshot data on ready).

## Cross-app matrix (audited 2026-07-01)

| app | boot download | status |
|---|---|---|
| **house** viewer | progressive BACKGROUND download (`viewer-instance.ts`), already outside the watchdog | safe (reference) |
| **house** admin | no snapshot — starts empty + full-resync | safe |
| **tutor** | IndexedDB + incremental `/changes` sync; NO blocking snapshot download | safe |
| **LD** dict | download AWAITED in the factory → **was** inside the 12 s cap | **fixed here** |

## Keep in sync with house

`boot-recovery.ts`, `leader-worker.ts`, `leader-election.ts`, `instance.ts`, `db-client.ts` are
the shared harness (already diverged on the role/dict axis — mirror by *function*, not bytes). All
of the above (idle watchdog, `reacquire`, `on_boot_failed`, `report_progress`) were mirrored into
house's `site/src/lib/db/worker/` the same day. House's fast factories emit no ticks, so the idle
watchdog is just a lenient 20 s cap there — strictly safe.

**NOT yet mirrored (2026-07-31):** the reload-once seam — `db-client.ts`'s
`boot_failure_terminal_reason` option, the `spawned.onerror` handler, and `BootFailure.terminal_reason`
in `instance.ts`. All three files are 🔴 divergent in house's `PARITY.md`, so LD taking them first
breaks nothing; house's own worker is re-examining its triage. When house adopts them, the classifier
+ recovery pair are the parts worth copying verbatim.

## Unrelated: 413 for oversized bodies

`hooks.server.ts` now pre-checks `content-length` against `BODY_SIZE_LIMIT` (16 M, unchanged) and
returns a clean **413** instead of letting adapter-node throw mid-body-read (which logged an opaque
500 `crash` — e.g. a 17 MB body probe at `/api/auth/email/send-code`).
