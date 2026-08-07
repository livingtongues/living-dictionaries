# Execute approved items from 2026-08-06 overnight reports

Source: `.cron/log-reviews/2026-08-06.md` + horse `.cron/nightly-reviews/2026-08-06.md`.
ALL changes are UNCOMMITTED — Jacob reviews and commits (push = deploy).

**Status: all 9 items done, verified.** `pnpm check` 0 errors · `pnpm lint` clean ·
`vitest run` 2691 passed / 4 skipped · `pnpm build` green (build-version check passed).

## Items

1. ✅ **Boot-error build identity (§1.3) + `is_bot` rider (§5.5)** — `insert-client-log.ts` gained
   `djb2()` (SvelteKit's own, pinned by test) + `resolve_app_version()`. `CURRENT_VERSION_HASH` is
   computed once at module load; an incoming `app_version` equal to it is stored as the REAL
   version, with the raw hash in `context.version_hash`. `context.is_bot: true` stamped at ingest
   from `is_bot_user_agent` (client-source rows only). Proven live against the dev server:
   `le6ujk` → `34fe97ec2616ad188ef15cfe5596e97a1f25af92`.
2. ✅ **Probe before you accuse (§1.4/§5.3)** — `stale-build-artifact.ts` gained
   `head_probe_artifact` / `probe_verdict_from_status` / `url_from_boot_message` /
   `classify_boot_failure`. `db-client.ts`'s failure path is now async and evidence-based; the
   injected hook takes `{ message, script_url, online }`. `dict-session.ts` stashes the evidence
   into every boot-failure + terminal row.
3. ✅ **Guard `crypto.randomUUID` (§1.2)** — `$lib/utils/new-uuid.ts` (`randomUUID` →
   `getRandomValues` v4 → `Math.random`), adopted at all 24 browser call sites across 9 files.
4. ✅ **Media sweep forked + instrumented (§1.6)** — work moved to `media-sweep-child.ts`
   (own chunk, `nice 19` / `ionice -c 3`, opens shared.db itself); `media-sweep-cron.ts` is the
   parent (fork + ALL telemetry). `media_sweep_reconciled` now carries `duration_ms` +
   `step_ms {list, ledger_diff, heal}` + `blocking_ms`.
5. ✅ **Photo upload (§1.5)** — `STORE_MEDIA_TIMEOUT_MS = 45_000` + `MediaStorageTimeoutError`
   (→ our own 504) and `photo_upload_completed` info with all six requested fields.
6. ✅ **Share-card store cap (§1.9)** — 1 GB → 4 GB, `MAX_ENTRIES` 5,000 → 20,000.
7. ✅ **`"seh "` → `"seh"`** — matches the existing `gl.seh` EN locale key.
8. ✅ **sqlite-proxy socket removal guard** — ported from house `a2040633`, with house's test.
9. ✅ **Refused-write device-side quarantine** — `rejected_pushes` in BOTH migration sets; both
   client engines quarantine the pushed payload inside the apply transaction, before the
   delete-echo/prune. Server ledger deliberately deferred.

## Decisions made while executing (worth knowing)

- **An UNRESOLVABLE version hash stays in `app_version`.** The review left this case open. An older
  build's hash is a genuinely non-current build, so keeping it there keeps the stale-error split
  CORRECT; nulling it would have undercounted real stale errors. It just wears a hash for a name
  until a dashboard resolves it — `version_hash` is now there for one that wants to.
- **`?worker&url` instead of a `URL` shadow.** Vite rewrites `new Worker(new URL('…',
  import.meta.url))` textually, so the URL cannot be hoisted into a variable. First attempt was a
  module-scoped `class URL extends globalThis.URL` shadow (which also had a TDZ bug). Vite's
  documented `./leader-worker.ts?worker&url` gives the URL as a plain string with no magic.
  **Verified in the real build:** the emitted chunk contains
  `new Worker(Se, …)` with `Se = "/_app/immutable/workers/leader-worker-B-DXtdCk.js"`, a file that
  exists on disk.
- **A 5xx probe response is NOT terminal.** `probe_verdict_from_status` treats only 404/410 as
  `missing`. A 500/503 is the server struggling; reloading onto "the current build" cannot help.
- **HEAD is load-bearing.** LD's service worker returns early for non-GET, so a HEAD always reaches
  the network instead of the cache whose staleness is in question. No cache-buster needed.
- **The `handled` claim is taken BEFORE the first `await`** in `handle_boot_failure` — the async
  verdict would otherwise open a window for a second boot outcome to slip through. Regression test
  exists.
- **The media-sweep child reports NO telemetry itself.** It has no logs.db handle by design, so
  per-dictionary alarms (`media_sweep_dict_unreadable` / `media_orphan_brake_tripped`) ride home in
  `summary.alerts` (capped at 50) and the PARENT emits them. Same shape as the audio backfill.
- **`db` is threaded, not globally overridden.** `media-ledger`, `photo-variants`,
  `video-thumbnails` and `media-metadata-probe` all take an optional `db` defaulting to
  `get_shared_db()`. The child must never call `get_shared_db()` (it would run migrations from a
  non-server process) — same rule as the retention/analytics children.
- **`transport.ts` is byte-parity-shared with house**, so its uuid guard is a self-contained inline
  `transport_uuid()` (no app import) and the SAME bytes were written into
  `~/code/house/site/src/lib/db/worker/transport.ts`. **house's `parity.test.ts` re-run green.**
  ⚠️ That leaves ONE uncommitted file in `~/code/house` — flagged to Jacob below.
- **Adding a dictionary migration means every open tab reloads once** after deploy (the
  `latest_dict_migration` handshake → 409 `schema_outdated`). Normal, expected cost of a dict
  migration; noted so it isn't a surprise on deploy day.
- **`prune_card_store` takes injectable caps now** — its entry-cap test wrote `MAX_ENTRIES + 5` real
  files, which at 20,000 timed out. The behaviour is what's under test, not the constant.
- **`cron-scheduler.test.ts`'s `$app/environment` mock needed `version`** — a partial mock 500s the
  whole suite once `insert-client-log` reads it.

## Verification performed

- `pnpm check` → 0 errors. `pnpm lint` → clean. `npx vitest run` → 2691 passed, 4 skipped.
- `pnpm build` → green, including `scripts/check-build-version.mjs`.
- **Built output inspected**: the worker URL resolves to a real emitted file; the media-sweep child
  is its OWN 22 KB chunk containing the guard + reconcile body and ZERO cron-scheduler references,
  while the hooks chunk holds only the `MEDIA_SWEEP_CHILD: "1"` fork option — byte-identical shape
  to the proven `audio-derivative-backfill` split.
- **The real built child chunk was forked end-to-end**: exit 0 in 8 ms, wrote a genuine
  `media_storage_daily` row, reported its summary over IPC.
- **All 46 migrations applied in order** into a fresh DB; `rejected_pushes` + its partial index are
  the head of both sets.
- **Live dev-server ingest check**: `le6ujk` resolved to the real build name with the hash kept; an
  older hash stayed put; ClaudeBot's UA got `is_bot: true`; a person's row was untouched.

## Not done (deliberately)

- The refused-write **server-side ledger** (house's second half) — explicitly deferred by Jacob.
- Everything else on the review's action list that wasn't in the approved set (snapshot reconcile
  off-thread, origin-direct uptime leg, font-cache keying, legacy audio-path repair, the
  `/admin/health` responsiveness line, house's two inbound cross-pollination items).

## ⚠️ For Jacob

`~/code/house` has ONE file changed by this work: `site/src/lib/db/worker/transport.ts` (the
byte-parity uuid guard). house had other unrelated uncommitted work in flight already.
