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

## Snapshot endpoint: public read, no R2 (yet)
The example gates `/api/dictionary/[id]/db` to editors with viewers on a public R2 bucket. LD has **no
R2** (far-future; media stays on **Google Cloud Storage** — see house). Since everyone opens wa-sqlite
(viewers pull-only), the snapshot endpoint **serves everyone** (mirrors the now-retired, ungated
entries-data endpoint); `fetch-snapshot` dropped the R2 branch → always the VPS endpoint. Push
(`/changes`) stays editor-gated; viewers/anonymous get pull-only.

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
