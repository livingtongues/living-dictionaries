# Dict boot: visual "downloading…" feedback (follow-up)

Follow-up from `.issues/leader-worker-boot-hang-robustness.md` (Jacob: "it would be nice to get
some visual feedback that something's happening too … maybe that's a follow-up issue").

## Context
The boot-hang fix (idle/no-progress watchdog + streaming snapshot fetch) means a slow-connection
first-load of a big dict now correctly WAITS for the download instead of timing out. But during
that wait the `[dictionaryId]` route just shows the generic loading state — the user on a poor
connection has no signal that a multi-MB snapshot is streaming in (vs. a hang).

## Goal
Surface boot/download progress in the dict UI: e.g. "Downloading dictionary… (X MB)" with a
determinate or indeterminate indicator while the leader worker's cold snapshot fetch is in flight.

## Wiring already in place to build on
- `fetch-snapshot.ts` already streams with an `on_progress(received_bytes)` callback (per chunk).
- `dict-instance.ts` calls `context.report_progress(stage)` per stage + per chunk.
- The harness has a `worker_perf` precedent in house (`viewer-instance.ts` emits a `worker_perf`
  DbEvent → the leader tab ships it via `track_timing`). LD could add a `boot_progress` DbEvent
  (stage + received_bytes [+ total from Content-Length when present]) broadcast to the main thread,
  surfaced through `DictLiveDb` / `page.data` for the route to render.
- Content-Length: `/api/dictionary/[id]/db` and the R2 object can expose the gzipped size; the
  decoded total isn't known up front, so an indeterminate bar (or bytes-received counter) is the
  safe default.

## Open questions
- Determinate (needs a total — gzipped Content-Length is a rough proxy) vs. indeterminate + a
  running MB counter.
- Where to render: the entries route loading state, or a global toast.
- Do the same for house's viewer cold download (it already emits `viewer_cold_download` perf; a
  live progress surface would help slow-connection new users there too).

## Status
- [ ] Not started (parked follow-up).
