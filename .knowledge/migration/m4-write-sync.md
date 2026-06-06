# M4 write/sync — wa-sqlite browser DB + bidirectional per-dict sync

Makes entry-content **writes real**: a browser **wa-sqlite** per-dictionary DB
(`dictionaries/{id}.db`) inside a **SharedWorker**, syncing bidirectionally with the server
better-sqlite3 per-dict DB via `POST /api/dictionary/[id]/changes`, bootstrapped by a
`GET /api/dictionary/[id]/db` snapshot. Plan + phase status: `.issues/m4-write-sync.md`.

## The LD architecture (Jacob's design, differs from the example)
The old site split: **Orama = search**, the **"data cache" (`entries_data` Record) = single-entry
reads**. Target (decided 2026-06-04):
- **wa-sqlite (full dict, EVERYONE opens it — editors push, viewers pull-only) is the client source
  of truth**, replacing the data cache.
- The **Orama worker stays the assembly+search engine but is fed FROM wa-sqlite** (not the server
  entries-data endpoint, which is **retired**). `read-dict-bundle.ts` queries the dict connection into
  the same legacy-shaped bundle `init_entries` always consumed.
- **Saves go to wa-sqlite only** (the example's `dict-live-db` write methods, via `operations.ts`).
  The single-entry view still reads the `entries_data` Record — now SQLite-fed — so zero entry-view UI
  churn (the prior all-at-once port botched UI; the DB/sync shape was well-specified, so the example's
  `dict-client/*` engine was ported near-verbatim).

The example made `dict-live-db` the read+write source and dropped Orama; LD keeps Orama. The per-dict
**schema, json-columns, migrations, and server `dictionary-db.ts` were already identical** in LD from
M4-read, so M4-write only added: server `dictionary-sync-helpers.ts` + the two routes, the whole
browser `client/{connection,live}` + `dict-client/*`, and `wa-sqlite`.

## Worker boundary: the Orama feed is main-thread-orchestrated
The Orama worker (`entry.worker.ts`, a Web Worker) **cannot read wa-sqlite** (which lives in a
SharedWorker). So the **main thread** (`[dictionaryId]/+layout.ts` → `entries-ui-store`) reads the
bundle from the dict connection (`read_dict_bundle`) and passes it to `init_entries(bundle, …)` over
comlink. Cost: the bundle crosses SharedWorker→main→entry.worker (two structured-clone hops) once per
load — fine for achi; for big dicts an optimization (give entry.worker its own SharedWorker port) is
possible later.

## Editor write path (P4a) and the interim double-write
`operations.ts` per-dict-content op = (1) `api.X` → Orama (instant UI) + (2) `dict_db.<table>` →
wa-sqlite (dirty=1) → SharedWorker engine pushes → server merges (LWW) → mirrors
`shared.db.dictionaries.updated_at`. Per-dict rows carry **no `dictionary_id`** (single-dict file) and
**require `created_by_user_id`/`updated_by_user_id`** (NOT NULL) — supplied client-side from
`page.data.auth_user.user.id`. Junctions (synthetic id PK + UNIQUE natural key): composite
link/unlink helpers. **Deletions = soft-delete (set `deleted`)**, matching LD's existing semantics
(NOT the `deletes`-tombstone path the example uses). The `api.X` half is a **deliberate interim**;
P4b replaces it with a watcher so Orama watches wa-sqlite (one path for local edits + remote pulls).

## TWO latent sync bugs (present in the example too — report upstream / to house)
Both only surface once you actually PUSH an editor edit, which is why M4-read/auth never hit them.

1. **`INSERT OR REPLACE` in a trigger fired from an UPSERT → `UNIQUE constraint failed`.** The
   `last_modified_at` bump triggers did `INSERT OR REPLACE INTO db_metadata (key,value) VALUES
   ('last_modified_at', …)`. The sync engine's `merge_dict_row` (server) and `#upsert_row` (client
   pulls) write rows with `INSERT … ON CONFLICT(id) DO UPDATE`. When that upsert fires the trigger
   (under `PRAGMA defer_foreign_keys=ON` + `BEGIN IMMEDIATE`), the **outer statement's conflict policy
   clashes with the trigger's `OR REPLACE`** and the trigger's insert raises UNIQUE on the existing
   `last_modified_at` row → the whole push 500s. A plain `UPDATE` fires the same trigger fine (so it
   was invisible until the upsert path existed). **Fix:** recreate every bump trigger with an explicit
   `INSERT … ON CONFLICT(key) DO UPDATE SET value=excluded.value` (composes cleanly with an outer
   upsert). Shipped as a NEW migration `20260605_fix_lmod_triggers.sql` (38 triggers) — NOT an edit to
   the immutable `20260525_initial.sql`; `run_sql_migrations` runs on every `get_dictionary_db` open so
   existing server dbs + client snapshots pick it up, and `LATEST_DICT_MIGRATION` advances on both
   sides so the migration handshake stays matched.

2. **`/changes` fast-bail silently dropped editor pushes.** The "nothing changed since cursor"
   fast-bail (`if (last_modified_at && synced_up_to && last_modified_at <= synced_up_to) return
   empty`) ran BEFORE processing dirty rows. A client's cursor almost always EQUALS the server
   watermark (it's set from the prior pull's `new_synced_up_to`), so an editor's very next push hit
   `<=` and was returned empty — the dirty rows never merged. **Fix:** compute `has_push` (editor has
   dirty rows or tombstones) and skip the fast-bail when `has_push`.

### A THIRD sync bug (LD-only divergence from the example) — found by LD-MEDIA
**The dirty-flag clear was a blanket `UPDATE "<table>" SET dirty = NULL WHERE dirty = 1`** in
`dict-sync-engine.ts` `#apply_response` — it cleared EVERY currently-dirty row, not just the ones this
sync pushed. Sync is read-then-push-then-clear: `#build_request` snapshots dirty rows, `#post` sends
them, `#apply_response` clears. Any row written AFTER the snapshot but BEFORE the clear (i.e. DURING the
in-flight HTTP round-trip) gets marked clean WITHOUT ever being pushed → it silently never reaches the
server. This bites whenever an op does **sequential writes** and a sync fires between them — exactly
`insert_photo` (writes `photos` then `sense_photos`) and `assign_speaker` (link_junction) under
`handle_exec`'s post-write `sync_if_needed()`. Symptom: the base row (photo/audio) synced but the
**junction** (sense_photos / audio_speakers — and by extension entry_tags, entry_dialects, etc.) did
NOT, so uploaded media looked unlinked on reload. Client rows showed `dirty=null` (falsely "synced")
while the server never had them. **Fix:** clear dirty ONLY by the pushed rows' ids
(`WHERE id = ?` per row in `request.dirty_rows[table]`) and drain ONLY the pushed tombstones by key —
matching the example engine (`db/sync/engine.svelte.ts`). The example was correct here; LD had
diverged. Required threading `request` into `#apply_response(response, request)`.

Debugging these: the SharedWorker's `fetch` + `console` do NOT surface on puppeteer `page.on('request'
/'console')`. Surface engine state by writing into `db_metadata` from inside `sync_once` and reading it
back via the cached connection (`globalThis.__ld_dict_connections[id].connection.query(...)`), and log
the server side from the endpoint (the e2e pipes server stderr). The cached connection is also the
deterministic way to flush a sync from a test: `await connection.sync_now()`.

## Headless OPFS: SharedWorker falls back to MemoryVFS (and that's OK)
A standalone dedicated-Worker probe showed OPFS + `createSyncAccessHandle` work in Chromium 148, but
inside the **dict SharedWorker** `opfs_is_available()` returns false → it uses **MemoryVFS**. That's
fine: a MemoryVFS instance is empty after migrations, and the engine's **sync-from-null pull**
backfills every server row, so reads + the edit round-trip still work. The persistence assertion rides
the sync POST (server SQLite), so it's independent of browser OPFS entirely. The dedicated e2e proves
persistence by reading the **server** `.data/dictionaries/achi.db` directly (better-sqlite3) AND by
loading a **fresh no-OPFS browser context** that must fetch the snapshot from the server.

## Snapshot endpoint — the "everyone opens wa-sqlite" decision (R2 added later)
The load-bearing decision worth keeping: **everyone opens the per-dict wa-sqlite DB** (editors push,
viewers pull-only), so the snapshot bootstrap serves everyone, not just editors. Push (`/changes`)
stays editor-gated; viewers/anonymous are pull-only.

> ⚠️ Superseded detail: this milestone shipped with **no R2** (VPS-only snapshot endpoint;
> `fetch-snapshot` had no R2 branch). R2 dict snapshots have since been added —
> `r2-snapshot-builder.ts` (cron) builds them and `fetch-snapshot.ts` now branches editor→VPS (fresh)
> vs viewer→public R2 (`snapshots.livingdictionaries.app`, CDN-cached). The current read path is the
> source of truth in the **database skill** (`dictionaries/<id>.db` section); don't trust this
> paragraph's original "no R2" framing.

## Seed self-sufficiency
`seed-achi-fixture.ts` opened achi.db raw (assumed M4-read pre-created the schema). The e2es re-seed,
so it now **runs the dict migrations from disk first** (a tsx script has no vite `import.meta.glob`, so
it `readdirSync`es the migrations dir + applies unapplied files, mirroring `run_sql_migrations`). This
also guarantees the new trigger-fix migration lands in the fixture db.

## Auto-sync timing (known, acceptable)
`handle_exec` calls `engine.sync_if_needed()` after each editor write, which runs `sync_once` unless a
sync is already in-flight (the bootstrap pull can briefly hold it) — then the next is the 30s periodic
timer. For deterministic e2es we nudge `connection.sync_now()` after the edit (same path). A future UX
nicety: a short retry after a skipped in-flight sync.

## P4b — the watch-based Orama feed (drop the double-write) (LD-P4B)
P4a kept an interim `api.X` double-write: every op wrote wa-sqlite AND directly pushed the change into
the Orama worker for instant UI. P4b removes that — **Orama now WATCHES wa-sqlite**, one path covering
both local edits and remote sync-pulls.

- **The single watch hook is `dict_db.subscribe(table, cb)`** (DictLiveDbImpl's internal
  `TableChangeNotifier`). It already fires for BOTH paths: local writes call `#notifier.notify(table)`
  inside `#insert/#update/#upsert/#save_cb/#delete_cb`; remote pulls arrive as the sync engine's
  `on_tables_changed` → SharedWorker `tables_changed` broadcast → DictLiveDbImpl fans it into the same
  notifier. So subscribing once per table covers everything — no separate broadcast plumbing needed.
- **`src/lib/search/orama-watcher.ts`** (main thread): on any notify (40ms debounce + in-flight guard
  with rescan), `SELECT * FROM <16 content tables> WHERE updated_at > watermark` (includes soft-deleted
  rows so removals propagate), `parse_dict_row`, batch by table → worker `apply_rows(changes)`, advance
  watermark to the max `updated_at` seen. Initial watermark = max `updated_at` across the init bundle;
  one catch-up scan on start closes the bundle-read→subscribe gap. **`updated_at` is compared as an ISO
  string** (lexicographic = chronological for the uniform ISO/UTC stamps both the client writes and the
  server LWW preserve).
- **Worker `apply_rows` (chosen over a main-thread re-assembler so entry assembly stays in ONE place):**
  FK-ordered dispatch (`apply_one(table, row)`). Base + junction maps hold **LIVE rows only** (a row
  with `deleted` set is removed from its map); the affected grouping slices are **RECOMPUTED from the
  source maps** per change (`recompute_entry_senses/_audios/_tags/_dialects`, `recompute_sense_*`,
  `recompute_audio/video_speakers`) rather than mutated in place — robust against upserts, soft-deletes,
  and pulled-new rows. This is what resolves **row→entry_id across all 16 tables**: junctions resolve via
  their pair maps (`sense_photos→senses→entry_id`), and speaker/tag/dialect renames fan out through
  `audio_speakers`/`video_speakers`/`entry_tags`/`entry_dialects` to every affected entry. Affected
  entries are re-assembled via the unchanged `process_entry` and reindexed once.
- **operations.ts** dropped every `api.X` call (it was the only caller); `get_pieces` no longer imports
  the worker. The worker's old `operations` object + 3 now-dead reverse-index maps
  (`sentence/photo/video_id_to_sense_ids`) were deleted.
- **Watcher lifecycle:** `init_entries` (hence `create_entries_ui_store`) re-runs on every in-dict
  navigation, so the watcher is cached on `globalThis.__ld_orama_watchers[dict_id]` and the prior one
  is `.stop()`ped before a new one subscribes — otherwise subscribers stack and apply_rows runs N times.
- **Perf note (deferred):** `recompute_*` / `apply_one` scan `Object.values(map)` (O(rows-in-table)) per
  affected entity. Fine for the verified dicts; for 50k-entry dicts add membership indexes before it
  matters. Not optimized now by design (correctness-first, per the plan).
- **Verification:** `e2e/dict-watch-2ctx.mjs` (NEW, `test:watch`) is the remote-pull proof — two
  isolated browser contexts (separate OPFS): ctx A (manager) edits + pushes; ctx B (logged-out,
  pull-only) `sync_now`s and its watcher re-indexes the entry, showing the new value **without a reload
  and without any double-write**. achi-flow + dict-sync still pass with the double-write gone.

## Pre-existing service-worker 404 surfaced by P4b (NOT caused by it)
The achi-flow/dict-sync `page.on('pageerror')` gate started failing on a SvelteKit service-worker
registration 404 (`/achi/service-worker.js`): with the default `kit.paths.relative`, the SW registers
at a route-relative URL that 404s (the SW is served at root). It's async/timing-dependent — P4a passed
by luck; P4b's extra watcher async shifts timing so the 404 lands inside the assertion window. Proven
pre-existing by rebuilding+running the committed P4a tree (passes "no uncaught page errors"). The two
e2e harnesses now filter that specific error; the real fix (drop the SW like the example repo, or
`paths.relative:false`) is a global call left for Jacob — tracked in `.issues/service-worker-404.md`.
