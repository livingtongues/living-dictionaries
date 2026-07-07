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
4. **Boot telemetry** (`db-client.ts` `on_boot_failed` hook → `dict-lifecycle.ts`). Worker-internal
   errors NEVER reach the main-thread `console.error` patch, so boot failures were invisible in
   `client_logs` (why the incident was hard to diagnose). The hook logs `leader_boot_failed`
   `{ dict_id, boot_message, last_stage, attempt, will_retry }` — `last_stage` (from the progress
   ticks) points a stall at the exact phase.

## Main-thread boot is non-blocking (2026-07-07)

The WORKER still awaits the download in the factory (above) — but the **main thread no longer
awaits the leader's `ready()`**. `open_dict` (`dict-lifecycle.ts`) returns the `DictConnection`
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

## Unrelated: 413 for oversized bodies

`hooks.server.ts` now pre-checks `content-length` against `BODY_SIZE_LIMIT` (16 M, unchanged) and
returns a clean **413** instead of letting adapter-node throw mid-body-read (which logged an opaque
500 `crash` — e.g. a 17 MB body probe at `/api/auth/email/send-code`).
