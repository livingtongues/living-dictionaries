# M4 · SQLite read layer (server better-sqlite3, READ ONLY)

Replace the M1 Supabase stub's READ path with a real **server-side better-sqlite3** layer
reading **real migrated data** (`shared.db` catalog + per-dictionary `dictionaries/{id}.db`),
feeding the existing routes. One reversible thing at a time; app builds + boots at every step.

> **OUT of scope** (later milestones): browser wa-sqlite + SharedWorker + bidirectional sync
> (M4-write), real auth, media upload, R2 snapshots. We keep the stub for everything not yet
> converted.

## Reference map (lean heavy on these)
- **Destination (`living-dictionaries-example`, read-only):**
  - `site/src/lib/db/server/{shared-db,dictionary-db,get-dictionary,run-sql-migrations,typed-query}.ts`
  - `site/src/lib/db/schemas/{shared,dictionary}.ts` + `shared-migrations/`, `dictionary-migrations/` (`20260525_initial.sql` each)
  - `site/src/lib/db/schemas/{json-columns,dictionary-json-columns}.ts` (auto-parse driver for JSON columns)
  - `packages/scripts/migrate-to-sqlite/` (reads live Supabase PG → SQLite; needs Supabase + good host)
  - `.knowledge/architecture/{supabase-to-sqlite-migration,dictionary-routes,db-sync-architecture}.md`
- **House playbook (cross-repo, proven on sibling):**
  - `~/code/house/.knowledge/architecture/firestore-to-sqlite-reader-port.md` — universal `+layout.ts`
    → server `+layout.server.ts`; isomorphic `load_*({ db })` seam; **pure projections that adapt
    SQLite rows → existing legacy view shapes** so components don't change; seed from already-local DB.
  - `~/code/house/.knowledge/tooling/adapter-node-native-deps.md` — ⚠️ **`better-sqlite3` MUST be in
    `dependencies`, not `devDependencies`** (adapter-node bundles devDeps + externalizes deps → inlines
    the `bindings` loader → `__filename is not defined` crash on first DB hit). Also add to
    `vite.config.ts` `ssr.external`, and root `pnpm.onlyBuiltDependencies: ['better-sqlite3']`.

## Current LD architecture (what M4 changes)
- Data flows through a **client-side Supabase stub** (`src/lib/supabase/stub-client.ts`) threaded
  via **universal** `+layout.ts`/`+page.ts` loads and stores (`parent().supabase`). Dummy data:
  `src/lib/mocks/dummy-{dictionaries,entries}.ts`.
- Catalog: `create_dictionaries_store` (`supabase/dictionaries.ts`) → `materialized_dictionaries_view`;
  globe (`/`) + `/dictionaries` list read `$page.data.dictionaries`. Dictionary detail:
  `[dictionaryId]/+layout.ts` resolves via `supabase.from('dictionaries').eq('url'|'id').single()`.
- Entries: the **Orama search worker** (`src/lib/search/entry.worker.ts`) pulls entry tables via
  `cached_data_table`/`cached_join_table` (`supabase/cached-data.ts`) from the stub, caches in IndexedDB,
  builds the search index in the browser. better-sqlite3 is server-only → entries need a server endpoint.

## KEY DATA FINDING (drives the data-source decision)
The example's local `site/.data/` has:
- **`shared.db` catalog: FULLY populated — 2136 dictionaries** (with coordinates in the SAME nested
  `{points:[{coordinates:{longitude,latitude}}]}` shape the legacy globe reads → near pass-through
  projection, only JSON columns need parsing).
- **Per-dict CONTENT: essentially absent — only 4 of 2136 dbs have entries:**
  `torwali` (9908), `80CcDQ4DRyiYSPIWZ9Hy` (227), `svetsian` (412), `a-fala` (6). The other 2132
  are empty schema shells (442KB). **`achi` (our e2e flow dict) has 0 entries.**
- Repopulating entries requires running `migrate-to-sqlite` against **live Supabase PG** from a
  well-connected host (pooler degrades super-linearly; run on the VPS, not the sandbox).

→ Implication: copying `.data` gives a **real, complete catalog** immediately (globe, list, detail),
but the **entries slice can only be proven on a populated dict** (use `torwali`), not `achi`.

## Proposed plan (phased; interview answers may adjust)

### Phase 0 · Plumbing + deps ✅ DONE (commit pending)
- [x] Added `better-sqlite3` `^12.8.0` + `drizzle-orm` `^0.44.7` to `site/package.json` **`dependencies`**;
      `@types/better-sqlite3` `^7.6.13` to devDeps. `pnpm install` → native build OK, lockfile **pure
      additions (0 lines removed)** — no version drift.
- [x] Root `pnpm.onlyBuiltDependencies: ['better-sqlite3']`; `vite.config.ts` `ssr.external: ['better-sqlite3']`.
- [x] Copied `db/server/{shared-db,dictionary-db,get-dictionary,run-sql-migrations,typed-query}.ts`,
      `db/schemas/{shared,dictionary,shared.types,dictionary.types,json-columns,dictionary-json-columns}.ts`
      + both `*-migrations/20260525_initial.sql` from the example, verbatim (sync/snapshot/orphaned-media
      NOT copied). `json-columns` + `dictionary-json-columns` carry in-source vitest blocks (LD supports
      `includeSource` + `define 'import.meta.vitest'`).
- [x] Verify: `check` 0 err / 15 warn · `test --run` **132 pass** (was 123; +9 json-columns) · `build` clean.
- [ ] `DATA_DIR` env: `.data` local (gitignored), `/opt/hosting/data` VPS — wired/verified in Phase A
      (no route imports the db layer yet, so no DB hit / `__filename` exposure until Phase A).

### Phase A · Catalog reads (the clean vertical slice) ✅ DONE (commit pending)
- [x] Seeded `site/.data/` from the example via `VACUUM INTO` (folds WAL): `shared.db` (2136 dicts) +
      per-dict dbs `torwali`(9908), `svetsian`(412), `80CcDQ4DRyiYSPIWZ9Hy`(227), `a-fala`(6), `achi`(0).
      `.data` gitignored.
- [x] New `db/server/get-dictionaries-catalog.ts`: `load_{public,private,all}_dictionaries({ db })` +
      `project_to_dictionary_view` (near pass-through; aliases `*_by_user_id` → legacy `created_by`/`updated_by`).
- [x] New `routes/api/dictionaries/+server.ts` GET (`?visibility=public|private|all`) reading shared.db.
      Browser globe/list/footer fetch this (SQLite is server-only; keeps the lazy client pattern + parallels
      the Phase-B entries endpoint).
- [x] Repointed `+page.ts` (`get_public/private_dictionaries`) + `create_dictionaries_store` to the endpoint.
- [x] Converted `[dictionaryId]/+layout` resolution → new `+layout.server.ts` (`get_dictionary_by_url_or_id`,
      shared.db, redirect-home on miss); `+layout.ts` reads `data.dictionary`. Per-dict content (entries,
      info, editors) stays on the stub for now (incremental).
- [x] Stub catalog rows kept: still legitimately back UNCONVERTED auth-gated paths (`admin/+layout.ts` list,
      `create_my_dictionaries_store`, `dictionaries` writes). Converted public catalog no longer hits the stub.
- [x] Verify (`e2e/catalog-sqlite.mjs`, new `test:catalog` script): API public=**220** (not 12 dummy) /
      private=949; `/dictionaries` list = 221 rows incl. real "Torwali"; `/torwali` resolves; unknown slug →
      home; **0 catalog-relevant pageerrors** (Mapbox + entries-CDN 403s are pre-existing/external, filtered).
      build: better-sqlite3 **external, 0 `__filename`** in server chunks. achi-flow **5/5** still passes.
      check 0/15 · test 132. ⏳ Jacob eyeballs :3041 globe/list/maps.

### Phase B · Entries reads (sequenced after A) ✅ DONE (commit pending)
- [x] New `db/server/get-dictionary-entries-data.ts`: reads the per-dict db, returns the 9 data + 7
      junction tables as arrays projected to the **legacy supabase shape** (JSON columns parsed via
      `parse_dict_row`, soft-deleted excluded, new-schema bookkeeping cols `dirty`/`*_by_user_id` dropped).
- [x] New `routes/api/dictionaries/[dictionaryId]/entries-data/+server.ts` GET: resolves url→id (shared.db),
      opens `dictionaries/{id}.db`, returns the bundle.
- [x] Rewired `entry.worker.ts`: dropped the Supabase stub + `cached_data_table`/`cached_join_table` bulk
      load; `init_entries` now fetches the bundle once and keys it (`key_by_id` / `key_by_pair`), then runs
      the SAME grouping + index build. Removed `supabase`/stub imports + the `cached && !can_edit` shortcut.
- [x] **Verify on REAL data (`torwali`, `e2e/entries-sqlite.mjs` / `test:entries`):** bundle = 9908 entries
      / 9908 senses; lexeme parsed as MultiString; bookkeeping stripped; `/torwali/entries` renders real
      entry links + the large count; **0 unexpected pageerrors**.
- [x] **achi-flow kept UNCHANGED** (Jacob's Q3 lean): seeded `achi.db` with the existing dummy fixtures via
      new reproducible `scripts/seed-achi-fixture.ts` (`seed:achi-fixture`) — maps legacy→per-dict schema
      (rename `*_by`→`*_by_user_id`, drop `dictionary_id`, JSON-stringify, synth junction PKs). achi-flow
      **5/5** now reads its 13 entries from SQLite; edits still ride the stub (write = M4-write, out of scope).
      (Repopulating achi from prod Supabase was moot: the flow asserts on dummy-specific entries, so real
      data wouldn't keep it "unchanged"; seeding the fixtures into SQLite does — and needs no prod secret.)
- [x] `cached-data.ts` now orphaned in app code (only its own db-test imports it) — left in place (harmless;
      the write/stub path is untouched until M4-write). check 0/15 · test 132 · build clean.

### Phase C · Cleanup
- [ ] Retire `stub-client.ts` read paths that are now real; keep write no-ops until M4-write.
- [ ] Update `.issues/vps-migration.md` M4 checkbox; write `.knowledge/`; append to the orchestration ledger.

## Verify (each phase green)
- `pnpm --filter=site check` → 0 errors · `test --run` green · `build` + `node build` boot.
- Shared headless launcher (`browser-launch.mjs`) vs `node build`: converted routes render real SQLite
  data, `page.on('pageerror')` empty, no stub fallback where converted.
- `site/e2e/achi-flow.mjs` still passes (or is updated to the real data / a populated dict).
- Jacob eyeballs :3041 (WebGL/maps).

## Interview decisions (2026-06-04)
1. **Data source = COPY** the example's `.data` as-is (catalog complete; entries for 4 dicts only).
2. **Catalog then entries**, both in M4-read (Phase A then Phase B).
3. **achi:** prefer repopulating achi via the migration so achi-flow keeps working; **repoint to
   `torwali` if hard.** Settled at Phase B verification — the migrate script supports
   `--dict-id achi --content-dicts achi` but needs the **prod `SUPABASE_DB_PASSWORD`** (→
   `aws-0-us-west-1.pooler.supabase.com:6543`) run from the EXAMPLE repo's secrets. Network works
   in-sandbox; the gate is whether the prod secret is present. If not → repoint entries e2e to torwali.
4. **Retire stub incrementally**, route-by-route. Write no-ops stay until M4-write.
5. **Standard layout:** `shared.db` + `dictionaries/{id}.db`; `DATA_DIR=.data` local / `/opt/hosting/data` VPS.

## Original open questions (answered above)
1. Data source: copy example `.data` (catalog complete, entries only for 4 dicts) vs run migrate script (Supabase).
2. Search worker: feed Orama from a SQLite server endpoint now (Phase B) vs keep CDN-cache/stub, catalog-only this milestone.
3. Routes-first order + which dict to prove entries on (torwali, since achi is empty).
4. shared.db vs per-dict layout + `DATA_DIR` (confirm `.data` local / `/opt/hosting/data` VPS).
5. Retire `stub-client.ts` incrementally (route-by-route) vs behind a flag.
