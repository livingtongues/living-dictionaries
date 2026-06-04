# M4 · write/sync — real wa-sqlite browser DB + bidirectional per-dict sync

Sub-session **LD-WRITE** on `vps-migration`. Makes entry-content **writes real**: a
browser **wa-sqlite** per-dictionary DB (`dictionaries/{id}.db`) inside a **SharedWorker**,
with **bidirectional sync** against the server better-sqlite3 per-dict DB via
`POST /api/dictionary/[id]/changes`, bootstrapped by a `GET /api/dictionary/[id]/db`
snapshot. Editing an entry persists to real SQLite + syncs; a reload reflects it from SQLite.

## Where we are coming from
- **M4-read** (done): catalog from `shared.db`; per-dict **entries READ** via the Orama search
  worker (`lib/search/entry.worker.ts` + `entries-ui-store.ts`), fed at `[dictionaryId]/+layout.ts`
  load by `GET /api/dictionaries/[id]/entries-data` (reads the server per-dict SQLite). The
  reactive UI binds to the Orama worker, NOT to wa-sqlite.
- **M4-auth** (done): real `AuthUser`/`ssr_user`/`dict_roles`; `can_edit`/`is_manager` from real
  `dictionary_roles`; `verify_auth_dict_role(event, dict_id, 'editor')` server write-gate exists.
- **The stub being replaced:** `src/lib/supabase/operations.ts`. Every mutation does **two halves**:
  1. `api.X(...)` → updates the in-memory **Orama** worker (instant UI; this is why achi-flow sees
     the edit), and
  2. `supabase.from(table).insert/update/upsert(...)` → the **stub** supabase client (no-op,
     in-memory, **lost on reload**).
  M4-write swaps **half #2** (stub persistence) for **wa-sqlite dict.db writes** that sync to the
  server per-dict SQLite. Half #1 (Orama) stays — it remains the read/search index.

## RESOLVED ARCHITECTURE (interview, 2026-06-04) — the LD target
The old site split: **Orama = search**, **"data cache" (`entries_data` Record) = single-entry reads**.
Target: **wa-sqlite (full dict, EVERYONE) is the client source of truth** (replaces the data cache);
**Orama stays the assembly+search engine but is now fed FROM wa-sqlite**; **saves go to wa-sqlite
ONLY** (no double-write to Orama); **Orama "watches" wa-sqlite** and reindexes only changed entries —
one path for local edits AND remote sync-pulls.

Resolved Qs:
- **Q1 reads = wa-sqlite source-of-truth, Orama fed from it.** Q2 = **ALL** (everyone opens wa-sqlite;
  viewers pull-only). Q3 = **everything** (all DB row writes via wa-sqlite, incl. media rows). Q4 =
  **port `dict-live-db` verbatim** + use its write methods. Q5 = **achi-flow full round-trip**.
- **T2-Q1 watch mechanism = local-watermark delta feed.** On any `tables_changed` broadcast, query
  wa-sqlite for rows `WHERE updated_at > last_indexed_at`, resolve each to affected entry_id(s),
  re-assemble + reindex only those entries, advance watermark. Uniform for local + remote. The
  row→entry_id resolution for junction/media tables is the trickiest bit — build table-by-table,
  starting with entries/senses (achi path), extend outward.
- **T2-Q2 retire `/api/dictionaries/[dictionaryId]/entries-data`** + the external
  `cache.livingdictionaries.app` CDN fast-path. wa-sqlite is the single feed: snapshot fast-path +
  sync deltas; sync-from-null backfills when empty (covers MemoryVFS/non-OPFS).
- **T2-Q3 single-entry view keeps reading the `entries_data` Record** (now SQLite-fed via the worker)
  — zero entry-view UI churn (the prior port's weak spot).
- **T2-Q4 media = rows-only.** All media DB rows + junctions sync via wa-sqlite; **GCS file upload
  (`upload_image/audio/video` → presigned PUT) stays on its current stub/legacy path until M4-media.**
  **Media stays on Google Cloud Storage** (server-held creds, like house) — **R2 + image cleanup are
  far-future, NOT a milestone in this port.** Reference house's server GCS up/down code at M4-media.

**No-R2 consequence for snapshots:** the example gates `/api/dictionary/[id]/db` to editors with
viewers using R2. Since (a) Q2=all and (b) no R2 exists, **serve the snapshot publicly** (mirror the
retiring entries-data endpoint, which is ungated) and **drop the R2 branch in `fetch-snapshot`** —
always fetch from `/api/dictionary/[id]/db`. `/changes` keeps editor-gated push; viewers pull-only.

Round-trip (verification): edit → wa-sqlite (`dirty=1`) → worker watcher reindexes that entry (instant
UI) → engine pushes dirty → `/changes` merges into server SQLite (LWW) + mirrors
`shared.db.dictionaries.updated_at` → reload → snapshot/sync repopulates wa-sqlite from server → Orama
shows the persisted edit. The persistence assertion rides the sync POST, **independent of OPFS**.

## What's ALREADY in LD (from M4-read/auth) — do NOT re-port
- `lib/db/schemas/dictionary.ts` (drizzle mirror), `dictionary-json-columns.ts`,
  `dictionary-migrations/20260525_initial.sql` — **identical to the example**, full sync scaffolding
  (`dirty`, `deleted`, `db_metadata`, `deletes`, `last_modified_at` triggers, `updated_at` indexes).
- `lib/db/server/dictionary-db.ts` — `get_dictionary_db`, `LATEST_DICT_MIGRATION`,
  `read_last_modified_at`, `read_dictionary_id`, `dictionary_db_path`, in-memory variant.
- `drizzle-orm` dep; `verify-dict-role.ts` + `verify.ts`; `get_shared_db`.
- Server per-dict DBs seeded in `.data/dictionaries/` (achi.db, torwali.db, a-fala.db, svetsian.db, …).

## What to PORT (new files, near-verbatim from the example)
Server:
- `lib/db/server/dictionary-sync-helpers.ts` — `DICT_SYNCABLE_TABLES` (19, FK-ordered),
  `process_dict_changes` (push dirty+tombstones, pull deltas since cursor, LWW), `VALID_COLUMNS`.
- `routes/api/dictionary/[id]/changes/+server.ts` — POST push+pull; `verify_auth_dict_role(…,'editor')`
  for editors, anonymous/no-role = pull-only; migration handshake; fast-bail; snapshot-expired.
- `routes/api/dictionary/[id]/db/+server.ts` — GET snapshot (`db.backup()` → gzip), editor-gated.
  (R2 viewer path is M4-R2 — not needed; only the VPS/editor branch is exercised.)

Client (browser):
- `lib/db/client/connection.ts` (the `SqliteConnection` type), `lib/db/client/live/notifier.ts`
  (`TableChangeNotifier`), `lib/db/client/live/reconcile-rows.ts` — the 3 deps `dict-live-db` needs.
- `lib/db/dict-client/*` — `opfs-vfs-loader.ts` (wa-sqlite + OPFS VFS, MemoryVFS fallback),
  `shared-worker.ts` (the worker entry: LRU of open dicts, per-dict engine, broadcasts),
  `shared-worker-lifecycle.ts` (`open_dict`, spawn/bye), `dict-connection.ts` (main-thread RPC shim
  implementing `SqliteConnection`), `dict-live-db.svelte.ts` (reactive wrapper + `insert/update/
  upsert/delete/_save/_delete` write methods — **we use the write methods**), `dict-sync-engine.ts`
  (push+pull in the worker), `fetch-snapshot.ts` (VPS branch), `dict-migrations-bundle.ts`
  (`import.meta.glob` of the dict migrations, client-importable), `rpc-types.ts`, `opfs-lru.ts`.

Constants (`src/lib/constants.ts`):
- `DICT_DB_OPFS_PREFIX = 'dictionaries/'`, `SNAPSHOT_EXPIRED_DAYS = 60`, `r2_dict_snapshot_key(id)`,
  and ResponseCodes `CONFLICT = 409`, `SERVICE_UNAVAILABLE = 503`, `GONE = 410` (others exist).

Deps / build:
- Add `wa-sqlite` to `dependencies` (lockfile fidelity; pin to the example's version).
- `vite.config.ts`: `optimizeDeps.exclude: ['wa-sqlite']` (its Emscripten loader resolves `.wasm`
  via a relative `import.meta.url` that pre-bundling breaks). SharedWorker via `new SharedWorker(new
  URL('./shared-worker.ts', import.meta.url), { type:'module' })` is bundled by vite automatically.

## Wiring (the seam)
- `[dictionaryId]/+layout.ts` (browser-only, editors only): `open_dict({ dict_id, has_editor_role:
  can_edit, auth:{} })` → `create_dict_live_db(connection)`; cache per dict_id on `globalThis`;
  return `dict_db` on `page.data`. SSR / non-editor → `dict_db: null`.
- `operations.ts` `get_pieces()`: also pull `dict_db` from `page.data`. In each text op, replace the
  `supabase.from(table).X` call with the matching `dict_db.<table>.insert/update/upsert/delete`
  (which stamp `dirty=1`/`updated_at`/UUID/json + tombstones). Keep the `api.X` Orama call.
- After a write, the worker auto-schedules a sync (`engine.sync_if_needed`); add an explicit
  `connection.sync_now()` hook for the e2e (and a manual "sync now" affordance later).

## Write surface (Q3 = everything; all DB rows via wa-sqlite)
ALL `operations.ts` per-dict-content writes swap their `supabase.from(table).X` persistence for the
matching `dict_db.<table>.insert/update/upsert/delete` (which stamp dirty/updated_at/UUID/json +
tombstones): `insert_entry`, `update_entry`, `insert_sense`, `update_sense`, sense delete,
`insert_sentence`, `update_sentence`, `delete_sentence`, `insert_tag`, `assign_tag`,
`insert_dialect`, `assign_dialect`, `insert_speaker`, `assign_speaker`, `insert_audio`,
`update_audio`, `insert_photo`, `update_photo`, `insert_video`, `update_video`. **Drop the explicit
`api.X` Orama calls** — the watcher reindexes from wa-sqlite.

**Media boundary:** the media DB ROWS sync via wa-sqlite, but the FILE upload helpers
(`addAudio`/`addImage`/`uploadVideo` → `upload_image/audio/video`) keep their current stub/legacy
GCS path until M4-media. (Media = GCS, server-held creds, like house. R2/cleanup = far future, not
this port.)

Non-per-dict-content writes stay on the stub for now: `update_dictionary` (catalog/`shared.db` —
admin-sync territory), `dictionary_info`/partners/editors reads.

## Verification (feedback loop)
⚠️ **RISK to de-risk FIRST:** the round-trip needs the browser wa-sqlite to hold the existing
entry/sense rows so a partial UPDATE (e.g. phonetic) hits a real row. That requires the **OPFS
snapshot** to load; the **MemoryVFS fallback starts empty** (example discards snapshot bytes) →
UPDATE affects 0 rows → nothing dirty → nothing syncs. So OPFS + SharedWorker must work in the
**headless Chromium 148** the shared launcher drives. **Probe this before the full build** with a
tiny headless test (open SharedWorker → `opfs_is_available()` → write+read a file). If OPFS is
unavailable headless, fallbacks: (a) make MemoryVFS load the snapshot by replaying INSERTs, or
(b) a node harness that exercises `dict-sync-engine` against a MemoryVFS pre-seeded with the
snapshot rows. The **server-side** `process_dict_changes` round-trip is also unit-testable (port the
example's `dictionary-sync.test.ts`).

Gates:
- `pnpm --filter=site check` 0 errors / 15 warn · `test --run` green (add sync-helper unit tests).
- `build` + `node build` boot (wa-sqlite `.wasm` served; better-sqlite3 stays external).
- **achi-flow reworked** to the real round-trip: dev-OTP login as the seeded non-admin achi-manager →
  edit phonetic + add/delete sense → `sync_now` → **reload** → assert the edit is present (served from
  server SQLite via entries-data, not a stub) → `page.on('pageerror')` empty. Optionally a dedicated
  `e2e/dict-sync.mjs` asserting dirty pushed + server row updated.

## Standing decisions (carry over)
UnoCSS global; adapter-node; native deps in `dependencies`; puppeteer-core via shared launcher;
snake_case / lowercase-hyphen / options-object / no `!` / not strict TS / few comments; one
reversible thing at a time; app builds+boots at every checkpoint; commit verified phases on
`vps-migration` only, **don't push**; Jacob eyeballs :3041.

## Open questions for Jacob (interview) — see session message
Q1 read architecture · Q2 editor-only scope · Q3 first-slice width · Q4 snapshot bootstrap ·
Q5 achi-flow round-trip · Q6 reuse dict-live-db write methods vs thin writer · + the headless-OPFS
verification risk.

## Build phases (each a verified commit on `vps-migration`; no push)
- [x] **P1 · server** ✅ `f6016bdf`. Ported `dictionary-sync-helpers.ts` + `/api/dictionary/[id]/
      {changes,db}` (snapshot served publicly; push editor-gated; resolves url→id) + constants +
      `dictionary-sync.test.ts`. check 0/15 · test 164 · build · curl smoke (snapshot + pull).
- [x] **P2 · client engine** ✅ `685126d4`. Ported `client/{connection,live/*}` + `dict-client/*`
      (incl. dict-live-db) + `wa-sqlite@^1.0.0` (lockfile-faithful) + vite exclude. Headless probe
      confirmed SharedWorker + OPFS + SyncAccessHandle all work in Chromium 148. check 0/15 · test 178.
- [x] **P3 · feed flip** ✅ `098aa003`. `[dictionaryId]/+layout.ts` opens dict_db for everyone
      (bootstrap snapshot + sync_now) → Orama worker fed from wa-sqlite (`read-dict-bundle.ts` →
      `init_entries(bundle)`) → **retired** the entries-data endpoint + CDN fast-path. achi-flow PASS
      (13 entries from wa-sqlite logged-out + in).
- [x] **P4a · real writes + round-trip** ✅ `70334be9`. operations.ts persists to `dict_db.X` (drop
      `dictionary_id`; audit ids; junction composite link/unlink; soft-delete via `deleted`). Kept
      `api.X` for instant UI (interim — P4b removes it). Self-sufficient seed (runs migrations).
      **Two latent bugs fixed (also in the example):** (1) `20260605_fix_lmod_triggers.sql` — the
      last_modified_at triggers' `INSERT OR REPLACE INTO db_metadata` 500s when fired from an UPSERT
      (outer ON CONFLICT vs trigger OR REPLACE under defer_foreign_keys); recreated all 38 with
      `ON CONFLICT(key) DO UPDATE`. (2) `/changes` fast-bail silently dropped an editor's dirty rows
      when `last_modified_at <= synced_up_to` (cursor usually == watermark); now only bails when
      nothing to push. **Verified:** NEW `e2e/dict-sync.mjs` PASS (edit → server SQLite persists +
      fresh no-OPFS context reads it) · achi-flow PASS with a reload round-trip assertion · check 0/15
      · test 178 · build.
### P4b implementation decision (LD-P4B session, 2026-06-04)
Chosen: **in-worker `apply_rows` dispatcher** (LD-WRITE option b) — entry assembly stays in the worker.
- **Watch hook:** `dict_db.subscribe(table, cb)` (DictLiveDbImpl.#notifier) already fires on BOTH local
  writes (`#insert/#update/#upsert/#save_cb/#delete_cb` call `notify(table)`) AND remote pulls (sync
  engine `on_tables_changed` → SharedWorker broadcast `tables_changed` → DictLiveDbImpl fans to notifier).
  One subscription covers both paths.
- **Watermark-delta watcher** (`src/lib/search/orama-watcher.ts`, main thread): on any notify (40ms
  debounce, in-flight guard + rescan), `SELECT * FROM <16 tables> WHERE updated_at > watermark` (incl.
  soft-deleted rows), `parse_dict_row`, batch by table → `apply_rows(changes)` in the worker, advance
  watermark to max updated_at seen. Initial watermark = max(updated_at) across the init bundle; one
  catch-up scan on start covers the bundle-read→subscribe gap.
- **Worker `apply_rows`:** FK-ordered dispatch. Base/junction maps hold only LIVE rows (delete on
  `deleted`); grouping slices RECOMPUTED from source maps per change (robust, no fragile in-place
  mutation) → resolves row→entry_id across all 16 tables (junctions via pair maps, speaker/tag/dialect
  renames fan out through entry_tags/entry_dialects/audio_speakers/video_speakers). Affected entries
  re-assembled via existing `process_entry` + reindexed once. Perf: recompute scans `Object.values`
  (O(rows)) per affected entity — fine for now; index later if needed (noted in knowledge).
- **Drop `api.X`** from operations.ts entirely (only caller); remove worker `operations` object.
- entries-ui-store gains `dict_db`; watcher cached on `globalThis.__ld_orama_watchers[dict_id]`
  (stop+replace) since init_entries re-runs per navigation.

- [x] **P4b · watch-based Orama feed (drop the double-write)** ✅ (LD-P4B, `vps-migration`). Chose
      option (b): in-worker `apply_rows` dispatcher (assembly stays in the worker) + main-thread
      `src/lib/search/orama-watcher.ts` watermark-delta feed driven off `dict_db.subscribe(table,…)`
      (fires on local writes AND remote pulls — ONE path). Dropped ALL `api.X` double-writes from
      operations.ts; removed the worker `operations` object + 3 dead reverse-index maps. Base/junction
      maps now hold LIVE rows only; grouping slices RECOMPUTED from source per change (robust). Watcher
      cached on `globalThis.__ld_orama_watchers[dict_id]` (stop+replace per navigation). **Verified:**
      check 0/15 · test 178 · build + node build boot · **achi-flow PASS** (edit/add/delete-sense via
      the watcher; reload persistence intact) · **dict-sync round-trip PASS** · **NEW
      `e2e/dict-watch-2ctx.mjs` PASS** (ctx A edits → ctx B pull-only watcher re-indexes from synced
      row, no reload, no double-write). Surfaced (did NOT cause) a pre-existing SW-registration 404 →
      `.issues/service-worker-404.md`; filtered the specific error in both e2e harnesses.
- [x] **Task 2 · house→LD sync audit** ✅ (LD-P4B). All three house bugs checked against LD's engine:
      none apply (architecture already prevents them) — see `.knowledge/migration/dict-sync-invariants.md`.
      (1) writes already gated until synced (layout `sync_now` on cold open + the `entries_data.loading`
      gate in `get_pieces`); (2) dict.db has NO `users` table/FK — `created_by_user_id` is plain NOT NULL
      TEXT; (3) dict-sync-engine is single-sector → unscoped `DELETE FROM deletes` is safe (and the
      `deletes` table is unused since LD soft-deletes via the `deleted` column).
- [x] Update `.knowledge/` + the orchestration ledger (LD↔house sync gotchas). ✅
