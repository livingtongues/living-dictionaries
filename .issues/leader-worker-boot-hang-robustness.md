# Leader-worker boot hang + robustness / observability gaps

## Trigger incident (2026-07-01)

User `eatb4running@gmail.com` (a **manager** on `river`) hit
`[leader-worker] boot failed: Error: leader boot timed out after 12000ms` loading
`/river/entries` on `new.livingdictionaries.app`.

**Actual sequence (from the user):** tab open on the OLD build → user **pushed a
deploy** (new hashed chunks + new dict migration `20260701_sources.sql`) → the API
did a bunch of writes → user returned, saw the **"older version, hit reload"** toast
→ reloaded → boot **hung ~12s repeatedly** across several reloads → **fully closing
the tab and reopening fixed it** (no storage clear needed).

## What was ruled out (all healthy)

- Server snapshot build (`/api/dictionary/river/db`: `backup()` + `journal_mode=DELETE`
  + gzip of the 14.5 MB river.db) = **358 ms**.
- R2 snapshot fresh: built 07:13, newer than dict `last_modified_at` 06:58.
- No write contention at 07:14 (last API write 06:58).
- Migration `20260701_sources.sql` is pure DDL (CREATE TABLE / ADD COLUMN nullable /
  triggers) — no table rebuilds. A migration throw would self-heal (delete+refetch),
  not hang.
- Held-SAH normally throws `NoModificationAllowedError` → `xOpen` returns
  `SQLITE_CANTOPEN` → fast `boot_failed`, NOT a 12s hang.

## Root-cause hypothesis (strongest)

The 12s watchdog (`with_boot_timeout`, `boot-recovery.ts`) only fires when the boot
factory **hangs** (never settles). The only awaits in the boot path that can hang
indefinitely are **network fetches** and possibly a blocking `createSyncAccessHandle`:

- `leader-worker.ts` dynamic-imports `../dict-instance`; `opfs-connection.ts`
  dynamic-imports `wa-sqlite/dist/wa-sqlite-async.mjs` (the wasm glue chunk).
- `dict-instance.ts drop_in_snapshot()` fetches the snapshot **with no abort/heartbeat**.
- The dedicated worker is a client of the **service worker** (`service-worker.ts`):
  `serve_precached` and `network_first` both `await fetch(...)` with **no timeout**.

**During a deploy** (`docker compose build && up -d` restarts the server) these fetches
can stall (connection accepted, no/late response) while the new SW is still installing
and old caches are being deleted → the boot's dynamic import / snapshot fetch hangs →
watchdog fires at 12s → repeated reloads during the deploy window keep hanging → once
the deploy settled + a fresh tab, it booted clean. Fits every symptom.

A slow-to-release OPFS SAH across the reload transition (if `createSyncAccessHandle`
blocks rather than throws on this browser build) is a secondary candidate. **We cannot
confirm which, because worker-side boot errors are NOT captured in telemetry** — hence
the observability item below is the keystone.

## Confirmed gaps to fix

### 1. Observability — worker boot failures are invisible (Q1: APPROVED)
- The `[leader-worker] boot failed` `console.error` runs **inside the dedicated worker**;
  `remote-log.ts` patches `console.error` only on the **main thread**, so it never reaches
  `client_logs`. The `boot_failed` message DOES bubble to the main thread in
  `db-client.ts spawned.onmessage` (currently only `console.warn`n).
- **House already has the pattern**: `worker_perf` DbEvent (`worker/instance.ts`), leader-tab
  ships timings via `track_timing` (`viewer-bootstrap.svelte.ts` using `db-client.is_leader()`),
  and `live-query-retry.ts` logs `live_query_*`. **LD has NONE of this.**
- Plan:
  - Add a generic `on_boot_failed` hook to `create_db_client` (keep the harness free of
    app-specific `remote-log` imports); LD's `dict-lifecycle.ts` passes a callback that
    `log_event`s `leader_boot_failed` `{ dict_id, message, attempt, will_retry }`. Mirror the
    hook into house's db-client (no-op or its own logger).
  - Add **boot stage breadcrumbs**: `dict-instance` emits a `worker_perf`-style event as each
    stage completes (`opfs_probe`, `snapshot_fetch`, `opfs_open`, `migrate`, `engine_start`).
    The main-thread client logs them, so a hang shows the last completed stage → we know WHICH
    stage stalled next time.

### 2. Single-tab dead-end (Q3: APPROVED to investigate+fix)
- `leader-election.ts` requests the Web Lock **once**. After `MAX_BOOT_RETRIES` the tab
  `resign()`s (frees the lock) but **never re-enters the election**. A *single* tab with a
  persistent boot problem dead-ends: `open_dict()`'s `client.ready()` never resolves, `dict_db`
  stays null forever. (leader-election.ts is byte-identical with house → mirror any change.)
- House mitigates with `boot_retry_decision` + `live-query-retry.ts` + a reader server-endpoint
  fallback. LD lacks the retry layer + fallback for dicts.
- Options: (a) re-enter election with backoff after resign; (b) port house's `live-query-retry`
  so callers keep retrying a booting leader; (c) both. Lean: (a)+(c-lite).

### 3. Boot watchdog vs. legitimately slow downloads (Q2 reframed)
- Original proposal (abort the fetch on a timeout) is WRONG per Jacob — must NOT abort a
  legit slow download (slow connections exist).
- The real latent bug his comment exposes: the **12s boot watchdog itself kills a slow-but-
  progressing snapshot download** (a 14 MB dict over slow mobile > 12s → always times out →
  single-tab dead-end). Fix: make the download tolerant of slow-but-progressing transfers
  (no-progress heartbeat, or run the download OUTSIDE the hang-timed region, timing only
  open/migrate) while still catching true stalls. Design TBD.

## Unrelated finding — send-code 17 MB body 500 (LOW severity)
- `client_logs` crash 06:46: `Content-length of 17000012 exceeds limit of 16777216 bytes`,
  route `/api/auth/email/send-code`, status 500.
- Cause: adapter-node `BODY_SIZE_LIMIT: 16M` (docker-compose.yml) rejects an oversized body at
  `await request.json()`. send-code bodies are tiny (`{ email }`) — the 17 MB (17,000,012 =
  deliberate round test size) was almost certainly another session testing agent-API body-size
  limits (Jacob: "we just updated the size of what the agent API can do"). Not a real incident.
- Consider: (i) if agent API bulk endpoints now legitimately exceed 16 M, raise `BODY_SIZE_LIMIT`
  (but that raises the DoS surface on ALL routes incl. auth); (ii) map over-limit to a 413, not a
  500 crash, to keep `client_logs` clean. Decide with Jacob.

## Cross-project audit result (2026-07-01)
- **house viewer**: progressive BACKGROUND snapshot download (`viewer-instance.ts`) — already
  outside the watchdog. SAFE (reference impl).
- **house admin**: no snapshot; starts empty + full-resync. SAFE.
- **tutor**: IDBBatchAtomicVFS + incremental `/changes` sync; NO blocking snapshot download. SAFE.
- **LD dict**: `dict-instance.ts open_and_wire → drop_in_snapshot` awaited INSIDE the factory →
  inside `with_boot_timeout(12s)`. **ONLY OFFENDER.**

## Finalized design — idle/no-progress boot watchdog (Jacob approved Q2=outside, Q3=reelect+retry)

Replace the fixed 12s cap with an **idle watchdog**: reset the deadline on every boot progress
"tick"; fire only after `idle_ms` (~20s) with NO progress. Unifies all three asks:
- **Q2**: `fetch-snapshot.ts` streams via `response.body.getReader()` and ticks per chunk → a
  slow-but-progressing download never trips; a dead connection (no bytes ~20s) / stuck SAH does.
  Keep LD's await-the-download semantics (NOT house's background swap) — LD dicts are editable, so
  swapping a snapshot over an empty DB an editor typed into would lose writes.
- **Q1**: the ticks carry a stage name (`probe|snapshot_fetch|opfs_open|migrate|engine_start`) →
  stage breadcrumbs. `db-client` gets a generic `on_boot_failed` hook; LD `dict-lifecycle` logs
  `leader_boot_failed { dict_id, message, last_stage, attempt, will_retry }` to client_logs. Mirror
  the hook into house (no-op there for now).
- **Q3**: after `MAX_BOOT_RETRIES`, `leader-election` re-enters the lock request with backoff instead
  of dead-ending; PLUS port house's `client/live/live-query-retry.ts` into LD so a booting/handoff
  leader is a transient (retry) not a hard error. Mirror election change into house.

Harness files touched (mirror LD↔house): `boot-recovery.ts`, `leader-worker.ts`, `instance.ts`,
`leader-election.ts`, `db-client.ts`. LD-only: `dict-instance.ts`, `fetch-snapshot.ts`,
`dict-lifecycle.ts`, new `live-query-retry` equivalent, `hooks.server.ts` (413).

## Status — COMPLETE (pending Jacob review; nothing committed)
- [x] Investigated; root-cause + cross-project audit documented.
- [x] Design finalized (idle watchdog).
- [x] Idle watchdog in `boot-recovery.ts` (`create_boot_watchdog`, `BOOT_IDLE_TIMEOUT_MS=20s`) + tests — mirrored to house.
- [x] Streaming snapshot fetch with per-chunk progress (`fetch-snapshot.ts` `read_body_with_progress` + `on_progress`).
- [x] Progress ticks wired: `dict-instance.ts` stages + `instance.ts` `report_progress` + `leader-worker.ts` watchdog/`last_stage` — mirrored to house.
- [x] Q1: `on_boot_failed` hook on `create_db_client` + `leader_boot_failed` log in `dict-lifecycle.ts` (+ house hook mirrored, house app-wiring left optional).
- [x] Q3: `leader-election.reacquire()` + capped re-election backoff in `db-client.ts` (`reelect_delay`, 2→30s) — mirrored to house. Live-query-retry was ALREADY ported in LD (`client/live/live-query-retry.ts`, used by `dict-live-db`).
- [x] Q1(413): `hooks.server.ts` content-length pre-check → clean 413 (16M unchanged).
- [x] Knowledge page in EACH repo: LD `migration/leader-worker-boot-robustness.md`, house `architecture/leader-worker-boot-robustness.md`, tutor `architecture/db-boot-download-robustness.md` (+ index links).
- [x] Follow-up issue created: `.issues/dict-boot-download-visual-feedback.md`.
- [x] tutor audit: confirmed clean (IndexedDB incremental sync, no snapshot download) — documented.

### Verification
- LD: `pnpm vitest run src/lib/db` (218) + `boot-recovery` (15) green; tsc 0 errors; eslint clean on touched files.
- house: `boot-recovery`/worker (20) green; tsc clean in touched harness (2 pre-existing markdown-image errors unrelated); eslint clean.
- **Real-browser e2e (headless puppeteer on the :3041 dev server)** — fabricated a public throwaway
  dict from `local-mquh8w6n` and drove it over the BroadcastChannel transport. **Before/after A/B**
  (stash my boot files → baseline → pop):
  - Normal boot: PASS both (leader ready + 2 entries backfilled) — streaming fetch + idle watchdog
    don't regress boot.
  - Wedge (hang first 3 leader spawns via `__LD_DB_BOOT_FAULT__`):
    - **baseline → FAIL** `ready:false` (dead-end); log `resigning leadership: leader boot timed out after 400ms`.
    - **my code → PASS** `ready:true, count:2` (recovered); log `resigning + re-electing in 2000ms: leader boot stalled — no progress for 400ms`.
  - NOTE: the shipped `tools/e2e/opfs-dict-smoke.mjs`/`opfs-dict-heal.mjs` can't run on THIS box —
    mustang's `.data` was reseeded with only throwaway `local-*`/`test*` dicts (no `nukuoro`/`achi`),
    so those tests' preconditions aren't met here (NOT a code issue). Verification used a fabricated
    local dict instead.

### Files changed
- LD harness: `boot-recovery.ts`, `leader-worker.ts`, `leader-election.ts`, `instance.ts`, `db-client.ts`.
- LD app: `dict-instance.ts`, `fetch-snapshot.ts`, `dict-lifecycle.ts`, `hooks.server.ts`.
- house harness (mirror): `boot-recovery.ts`, `leader-worker.ts`, `leader-election.ts`, `instance.ts`, `db-client.ts`.
- Knowledge: 3 pages + 3 index edits. Follow-up issue: 1.

### Not done (deliberately, per Jacob)
- Did NOT add a fetch-abort on slow downloads (Jacob: never abort a legit slow download).
- Did NOT raise BODY_SIZE_LIMIT (Jacob: leave 16M).
- Visual boot-download feedback = parked follow-up issue.
- house `on_boot_failed`→remote-log app wiring left optional (hook is present; re-election benefits house automatically).
