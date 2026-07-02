# Approved fixes batch — 2026-07-02 (coordinator dispatch, LD single writer)

Seven approved items from the 07-01 log-review + nightly-review + one direct-from-Jacob item.
Verify with `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Items — ALL DONE ✅ (pnpm test 976✓ · check 0 errors · eslint clean · svelte-look verified)
- [x] **LD1** — Null-guarded `wrapperEl` in `Keyman.svelte` `targetInput()` + `waitForCKEditorToInitAndBeTargeted()`
  (early-return + optional-chain). Kills the recurring `firstElementChild`-on-null unhandled_rejection.
- [x] **LD2** — `dictionaries.ts`: the `!user_id` guard already existed; remaining case is a stale session
  cookie → expected 401. Now only non-401 statuses `console.error` (401 is a benign auth gate, no more
  false `error` row).
- [x] **LD3** — Added `'exceeds limit of'` to `KNOWN_NOISE_PATTERNS` in `classify-error.ts` + test.
- [x] **N1** — `validate-media-bytes.ts`: ambiguous containers now carry a `container` label; the image
  category rejects any category-less (audio/video) container even under `application/octet-stream` — a
  WebM/Ogg can no longer be stored as a photo. Audio/video still accept them. Added the Ogg/WebM ×
  image/audio/video matrix (all green).
- [x] **N2** — Replaced the raw `0x00` NUL in `endpoint_key` with a named `ENDPOINT_KEY_SEPARATOR = '\0'`
  (escaped → pure-ASCII source, byte-identical runtime). File is text again (`git grep` reads it). Added a
  regression test asserting the source has no NUL byte.
- [x] **N5 (LD half)** — Named the strategy `BOOT_STRATEGY = 'blocking_snapshot_boot_with_idle_watchdog'`
  (exported const + module doc) in `dict-instance.ts`. Did NOT build the house-owned parity manifest.
- [x] **LD6** — Byte-level dict-boot download progress bar. Plumbed VPS `x-db-bytes` → fetch-snapshot →
  report_progress detail → leader-worker postMessage → db-client `on_boot_progress` → `dict-boot-progress`
  rune store → `DictBootProgress.svelte` in the root layout. Determinate % for editors (VPS total),
  indeterminate + MB for viewers (R2). Verified all 5 states via svelte-look
  (`DictBootProgressDemo` wrapper + stories).

## LD6 plan (byte-level boot progress)
Boot is blocking: `[dictionaryId]/+layout.ts` `await open_dict()` → the bar must live in the ROOT layout
(rendered above the blocked child load); the worker posts progress during the pending load.

1. `/api/dictionary/[id]/db/+server.ts` — add `x-db-bytes` header = uncompressed byte length (editors get
   an accurate total; fetch decodes gzip so Content-Length is compressed & unusable). Viewers/R2 → no
   header → indeterminate bar.
2. `fetch-snapshot.ts` — `on_progress` now conveys `{received_bytes, total_bytes?}` (read `x-db-bytes`).
3. `worker/instance.ts` `InstanceContext.report_progress` — optional 2nd arg `detail?:{received_bytes?,total_bytes?}`
   (LD-local; already diverged from house).
4. `dict-instance.ts` — pass byte detail through on `snapshot_fetch`.
5. `worker/leader-worker.ts` — forward `{type:'boot_progress',stage,detail}` to main thread (+ existing tick).
6. `worker/db-client.ts` — new `on_boot_progress` option, relayed from the worker message.
7. `dict-lifecycle.ts` — wire `on_boot_progress` → a `dict-boot-progress.svelte.ts` rune store (activate on
   first `snapshot_fetch` so cached/follower/memory boots never flash a bar); end on `ready()`.
8. `DictBootProgress.svelte` in root layout; hide the generic `LoadingIndicator` while a boot bar is active.

Harness note: the truly byte-identical LD/house files are db-capabilities, leader-election, opfs-connection,
opfs-sah-vfs, persistent-storage, transport. `instance.ts / leader-worker.ts / db-client.ts / boot-recovery.ts`
ALREADY diverge → LD6 edits land there LD-locally.
