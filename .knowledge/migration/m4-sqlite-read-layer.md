# M4 · SQLite read layer (catalog + entries)

Decisions/gotchas from replacing the M1 Supabase stub's READ path with real server
better-sqlite3 reads. Plan + per-phase log: `.issues/m4-sqlite-read.md`. Code is the
source of truth; this captures what the code can't tell you.

## Architecture LD inherited (why it differs from house's reader port)
LD's data flowed through a **client-side Supabase stub** threaded via *universal*
`+layout.ts`/`+page.ts` loads + stores, and entries came through an **Orama search worker**
(`lib/search/entry.worker.ts`) that paged the stub with `cached_data_table` and cached in
IndexedDB. better-sqlite3 is server-only, so M4 split into two seams:
- **Catalog** (globe `/`, `/dictionaries`, footer, dict resolution): a server **endpoint**
  + a server **layout load**. We did NOT SSR the whole 2136-row catalog on every page — the
  browser still lazy-fetches `/api/dictionaries` (keeps the existing client store/function
  contracts; parallels the entries endpoint). Only the single-row dict resolution is a server
  load (`[dictionaryId]/+layout.server.ts`, the example's pattern).
- **Entries**: a single **bundle endpoint** (`/api/dictionaries/[id]/entries-data`) that the
  worker fetches once, replacing the per-table Supabase paging. We dropped the `cached_data_table`
  IndexedDB protocol entirely for reads (local SQLite is fast); the worker's grouping + index
  build are unchanged.

## The data we shipped (key finding)
The example's already-migrated `site/.data/` has a **fully populated `shared.db` catalog
(2136 dicts)** but **per-dict CONTENT for only 4 of 2136 dbs** (`torwali` 9908, `svetsian` 412,
`80CcDQ4DRyiYSPIWZ9Hy` 227, `a-fala` 6). Copying `.data` (mirroring house's "use already-local
data" lean) gives a real catalog + real entries for those 4. **achi (the e2e flow dict) has 0
entries** — repopulating it from prod Supabase needs the `SUPABASE_DB_PASSWORD` + a well-connected
host (the migrate-to-sqlite pooler degrades super-linearly; it's a VPS-scale job). Seed clean
single-file copies with `sqlite3 SRC "VACUUM INTO 'DEST'"` (folds the WAL; avoids copying
`-wal`/`-shm`). `.data` is gitignored; `DATA_DIR` = `.data` local (cwd is `site/`) / `/opt/hosting/data` VPS.

## Projections (SQLite rows → legacy supabase shapes, so components don't change)
- **Catalog** (`db/server/get-dictionaries-catalog.ts`): near pass-through — `shared.db.dictionaries`
  already matches `DictionaryView` incl. the nested `coordinates.points[…]` the globe reads; only
  alias `created_by_user_id`→`created_by`, `updated_by_user_id`→`updated_by`. `public` is integer
  1/0 (legacy filtered `.eq('public', true)` → `WHERE public = 1`; private overlay =
  `public != 1 AND con_language_description IS NULL`).
- **Entries** (`db/server/get-dictionary-entries-data.ts`): per-dict tables use JSON columns
  (`lexeme`, `glosses`, …) + `created_by_user_id`/`dirty` bookkeeping absent in the legacy rows.
  Project = `parse_dict_row` (JSON parse via `DICT_JSON_COLUMNS`) + `WHERE deleted IS NULL` +
  **drop `dirty`/`created_by_user_id`/`updated_by_user_id`** so they don't leak into the search
  index / EntryData `main`. The worker keys arrays back into Records (`key_by_id` / `key_by_pair`).
  Column names otherwise match what the worker expects (storage_path, serving_url, hosted_elsewhere, …).

## adapter-node native-deps gotcha (confirmed, as house warned)
`better-sqlite3` MUST be in **`dependencies`** (+ `drizzle-orm`, used by the schema types), NOT
devDeps — adapter-node externalizes deps but bundles devDeps, which would inline the `bindings`
loader → `__filename is not defined` at runtime. Also root `pnpm.onlyBuiltDependencies:
['better-sqlite3']` (native build approval under pnpm v10) + `vite.config.ts` `ssr.external:
['better-sqlite3']`. Verify in the build: the server chunk has `from 'better-sqlite3'` and **0
`__filename`**. Adding these 3 deps was a pure lockfile addition (0 lines removed) — no drift.

## achi-flow stayed unchanged by seeding fixtures into SQLite
The achi editor e2e asserts on 13 dummy entries (`e_ja`, phonetic "haʔ", …). Repopulating achi
with *real* Supabase data would NOT keep the flow "unchanged" (assertions are fixture-specific).
Instead `scripts/seed-achi-fixture.ts` (`pnpm -F site seed:achi-fixture`) loads the existing
`dummy-entries.ts` fixtures into `achi.db` — the natural "stub data now lives in SQLite" move:
rename `*_by`→`*_by_user_id` (junction fixtures only carry `created_by`; both are NOT NULL → fall
back to each other), drop `dictionary_id`, JSON-stringify per `DICT_JSON_COLUMNS`, synthesize
junction PKs, insert only columns that exist (PRAGMA table_info). Entry/sense WRITES still ride the
stub (write = M4-write); the flow's edits update the in-worker index, reads come from SQLite.

## Verification harnesses (puppeteer-core via the shared launcher, vs `node build`)
- `e2e/catalog-sqlite.mjs` (`test:catalog`): API public 220 / private 949; `/dictionaries` 221 rows
  incl. real Torwali; dict detail resolves; unknown slug → home.
- `e2e/entries-sqlite.mjs` (`test:entries`, `DICT=torwali`): bundle 9908 entries; `/torwali/entries`
  renders real entries; lexeme parsed; bookkeeping stripped.
- Both **filter known-external errors** — Mapbox tile 403s (no WebGL/token in headless) and the
  entries-worker CDN-cache 403 (`cache.livingdictionaries.app`, still attempted before the SQLite
  load) — so the pageerror assertion reflects the conversion's health, not pre-existing noise.

## Still on the stub after M4-read (by design, not oversight)
Admin dictionary list, `create_my_dictionaries_store`, the dict layout's `dictionary_info`/editors,
and ALL writes — they're auth-gated or write-path, so they come off the stub at **real-auth** /
**M4-write**, not here. `cached-data.ts` is now orphaned app code (only its db-test imports it) —
left in place; it's the write/stub path's territory.
