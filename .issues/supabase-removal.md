# Remove Supabase entirely + consolidate types onto Drizzle

Branch `vps-migration`. Goal: cut the LAST Supabase ties out of the app, make **Drizzle the
single source of truth** for every data shape (no shape loss), and retire the legacy
`@living-dictionaries/types` package. Verified by `pnpm --filter=site check` (0 errors, ~62
warn baseline) + `test --run` + headless boot. Jacob eyeballs `:3041`.

## Decisions (Jacob, 2026-06-05)
- **FULL removal** — migrate every stub-shim read/write to real SQLite, delete `src/lib/supabase/`.
- Domain types → `site/src/lib/types/` (plain `$lib`), retire `@living-dictionaries/types`.
- **No quarantine** of Supabase DB types — anything still needed gets a proper Drizzle-sourced home; the rest is deleted.
- **history + api-keys features → `archive/`** (top-level, matches house/tutor) for a future re-attempt; not deleted. External REST API (`api/external/*`) goes with api-keys.
- **No `.knowledge` doc** — verify type-correctness myself via `check`.
- Full tooling sweep (top-level `supabase/`, postgres seed, old db-tests, scripts deps, supabase CLI, generate-types, pg deps).

## Key facts learned
- Drizzle is already source of truth for live data: `site/src/lib/db/schemas/{shared,dictionary}.ts`
  (40 tables, `$type<>()` JSON shapes) + `InferSelectModel` row machinery (`db/client/live/types.ts`,
  `dict-client/dict-live-db.svelte.ts`). `dictionary_info` is folded into the `dictionaries` table
  (`about`/`grammar`/`citation`/`write_in_collaborators`). `partners`/`invites`/`roles` have real tables.
- The repo is **half-migrated**: `+layout.server.ts` already resolves `dictionary` from shared.db via
  `get_dictionary_by_url_or_id`; `api/dictionaries/[id]` DELETE + `roles/` endpoints exist; real auth exists.
  The Supabase stub paths are leftover duplicates.
- The **example repo** (`~/code/living-dictionaries-example`, finished end-state) is the template: its new
  `site/` has NO `src/lib/supabase`, imports the legacy types pkg in 0 real statements, deleted history/keys/
  external, moved contributors to `+page.server.ts`, update→`api/dictionaries/[id]/catalog`, EntryHistory→empty state.
- `EntryData` = hand-written composite of `Pick<Tables<'senses'|'audio'|...>, ...>` (38 uses, incl. runtime
  store `Record<string, EntryData>`). Re-source from Drizzle `InferSelectModel` — same field names, more precise shapes.
- Legacy types symbol tally in site/src: Tables 39, EntryData 38, DictionaryView 17, IRegion 9, TablesInsert 7,
  Database 7, IPoint 6, TablesUpdate 5, PartnerWithPhoto 5, MultiString 5, IColumn 5, EntryFieldValue 5,
  HostedVideo 4, Orthography 3, IPrintFields 3, PartOfSpeech 2, IGlossLanguages 2, Coordinates 2, + singles.
- `mode` exported from `$lib/supabase` is just `import.meta.env.MODE` (Header/User import it) — not Supabase.
- `types/` package wiring is drifted: dangling symlink `site/node_modules/@living-dictionaries/types ->
  ../../../packages/types` (gone); lockfile has both `link:../types` (ok) + stale `link:../packages/types`.

## Phases (keep app compiling at each checkpoint; `check` after each)

### Phase A — Archive history + api-keys/external ✅ when done
- [ ] Create top-level `archive/` (graveyard, outside build).
- [ ] Move `site/src/routes/[dictionaryId]/history/` → `archive/history/route/` (page.svelte, +page.ts, RecordRow.svelte, sortRecords.svelte).
- [ ] Move `site/src/routes/[dictionaryId]/keys/` → `archive/api-keys/keys-route/`.
- [ ] Move `site/src/routes/api/external/` → `archive/api-keys/external-api/`.
- [ ] EntryHistory.svelte → empty "work in progress" state (copy example); archive original to `archive/history/`.
- [ ] entry/[entryId]/+page.ts → drop the `content_updates` load.
- [ ] SideMenu.svelte → remove history + keys nav links.
- [ ] Grep for other refs to removed routes (links, redirects, i18n keys can stay).

### Phase B — Rewire dictionary read/write off the stub
- [ ] `[dictionaryId]/+layout.ts` — drop `getSupabase`, `data.supabase`, `dictionary_info`/editors/partners readables,
      `update_dictionary`. Move dictionary catalog metadata onto `dictionary` (already from +layout.server.ts).
- [ ] `contributors/+page.ts` → `+page.server.ts` reading shared.db (roles⋈users, partners) — port example.
- [ ] `about/+page.ts`, `grammar/+page.ts` → delete; read about/grammar off `page.data.dictionary`.
- [ ] `SelectedDict.svelte` → read off catalog row (no `$page.data.supabase`).
- [ ] `invite/[inviteId]/+page.ts` → `+page.server.ts` reading shared.db invites/roles — port example.
- [ ] `settings` update_dictionary → new `api/dictionaries/[id]/catalog` endpoint (+ `_call.ts`) writing shared.db (manager-gated). Port example.
- [ ] `create-dictionary/+page.ts` + `api/db/create-dictionary` → real shared.db create (repoint or port example client path). Delete `api/db/`.
- [ ] `api/db/delete-dictionary` → already replaced by `api/dictionaries/[id]` DELETE; delete old endpoint + its plan.md.
- [ ] `api/email/{announcement,request_access,invite,new_user,...}` → repoint stub reads to shared.db (users/email_aliases, roles⋈users, invites/dictionaries).
- [ ] `hooks.server.ts` → drop `getSession`/legacy session shim. `app.d.ts` → drop `Supabase`, `getSession`, supabase PageData.

### Phase C — Delete the stub
- [ ] Delete `site/src/lib/supabase/` (admin, cached-data, cached-query-data, dictionaries, get-legacy-session.server, index, operations, stub-client).
      Note: `operations.ts` is imported by `lib/dbOperations.ts` + `helpers/media.ts` → those already write via dict_db; verify/repoint.
      `dictionaries.ts` (create_dictionaries_store/create_my_dictionaries_store) → move to `$lib/dictionaries.ts` (they fetch real `/api/...`).
- [ ] Replace `mode` import (Header/User/create-dictionary) with `import.meta.env.MODE` or a `$lib/mode.ts`.
- [ ] Remove `@supabase/supabase-js` dep.

### Phase D — Type reorg onto Drizzle
- [ ] Create `site/src/lib/types/` (index barrel). Move hand-written domain interfaces from top-level `types/`:
      coordinates, gloss, gloss-language, example-sentence, photo, video, semantic-domain, part-of-speech, column,
      print-entry, entry-fields, user.interface, orthography, content-update, unsupported, content-import, PartnerWithPhoto.
- [ ] Re-source DB-shape types from Drizzle in `$lib/types/db.ts`:
      `Tables<T>` via TableMap → `InferSelectModel` (shared+dict); `TablesInsert`/`TablesUpdate` → Insert/Partial;
      `DictionaryView` → `InferSelectModel<typeof dictionaries>` + view extras (role, created_by/updated_by aliases — confirm consumers);
      `EntryData` → rebuilt from Drizzle picks. `Database` — confirm zero consumers post-stub, then drop.
- [ ] Global: `from '@living-dictionaries/types'` → `from '$lib/types'` across site/src (~130 files).
- [ ] Delete `types/supabase/` (generated/combined/augments). Delete top-level `types/` package.
- [ ] site/package.json: drop `@living-dictionaries/types` dep. Fix pnpm-lock + dangling symlink (pnpm install honoring lockfile fidelity).
- [ ] Fix check errors surfaced by stricter Drizzle shapes (Json→MultiString, nullability) — these are real correctness wins.

### Phase E — Tooling sweep
- [ ] Delete top-level `supabase/` (config.toml, migrations, functions, ideas, seed.sql, summarized-migrations.sql).
- [ ] Delete `site/src/docs/Supabase.md`.
- [ ] Delete `site/src/lib/mocks/seed/postgres.ts`; remove `pg` + `@types/pg` from site deps if no other use.
- [ ] Delete old Supabase-targeting db-tests: `db-tests/clients.ts`, `cached-data.test.ts`, `entries-data.test.ts`, `users.test.ts` (verify nothing else imports clients.ts).
- [ ] Root package.json: remove `generate-types` script + `supabase` CLI devDep.
- [ ] scripts/ (out of workspace): give it a small local types copy or relative import; remove `@living-dictionaries/types`, `@supabase/supabase-js`, `pg`, `config-supabase.ts`, `migrate-to-supabase/` as appropriate (don't break ids-import).

## PROGRESS (2026-06-05)
- ✅ Phase A (archive history+keys+external → `archive/`; EntryHistory removed; nav links pruned)
- ✅ Phase B (about/grammar→catalog row + `api/dictionaries/[id]/catalog`; contributors→`+page.server.ts`
  + `partners`/`invites/[id]` + `invites/[id]/accept` endpoints; SelectedDict/EntriesPrint off stub;
  dict `+layout.ts` cleaned; create-dictionary→`api/dictionaries/create`; invite→server load+accept;
  email invite/request_access→shared.db; announcement/new_user deleted; `api/db` deleted)
- ✅ Phase C (deleted `src/lib/supabase/`; operations.ts→`db/dict-client/`, dictionaries.ts→`$lib/`,
  `$lib/mode.ts`; hooks.server eager shared-db init; app.d.ts cleaned; @supabase/supabase-js usage gone)
- ✅ Phase D (`$lib/types/` with Drizzle-sourced `Tables/TablesInsert/TablesUpdate/DictionaryView/EntryData`;
  130 imports repointed `@living-dictionaries/types`→`$lib/types`; deleted dead stub mocks + postgres seed.
  **0 check errors.** Reconciliations: integer↔boolean (public/print_access/private/hide_logo/language_used),
  featured_image shape, orthography.name string, metadata typed.)
- ✅ **`linguistic_history` resolved (2026-06-05):** added as a real JSON `MultiString` column on the Drizzle
  `entries` schema + `20260525_initial.sql` (after `notes`, edit-in-place per Jacob — nothing deployed yet, VPS
  has no per-dict DBs). Removed the `EntriesRow`/`EntriesInsert` shim and collapsed the `entries` special-casing
  in `Tables/TablesInsert/TablesUpdate`. ALTERed the 5 local `.data/dictionaries/*.db`. Updated the
  `DICT_JSON_COLUMNS.entries` test assertion. (Existing torwali corpus rows are NULL — built by the *example*
  importer which dropped the field; this repo's `scripts/import/generate-sql-statements.ts` DOES write it, and
  the editor write path now persists it.)
- ✅ Phase E (tooling sweep): deleted top-level `supabase/`, `src/docs/Supabase.md`, `vitest.config.db.ts`;
  removed `@supabase/supabase-js`, `@living-dictionaries/types`, `pg`, `@types/pg` from site deps +
  `supabase` CLI + `generate-types`/`reset-db`/`test:db*` scripts from root/site; `pnpm install` (−168 pkgs,
  **0 version drift**); fixed stale `vitest.workspace.ts` (`packages/*` → `site`); lint-clean (site).

### Verify
- [x] `pnpm --filter=site check` → **0 errors** (18 warnings).
- [x] `pnpm --filter=site test --run` → **325 passed** (3 CSV snapshots updated public:false→0).
- [x] `pnpm --filter=site build` → adapter-node output, boots to HTTP listen (port-conflict only).
- [x] `pnpm lint` → site/root clean (5 remaining errors are PRE-EXISTING in `scripts/`, see below).
- [ ] Jacob eyeballs `:3041` — esp. featured images (shape changed to `serving_url`/`storage_path`),
      contributors editing (new endpoints), settings save, create-dictionary, invite accept.

## REMAINING (out-of-app, needs Jacob + a feedback loop)
- **`scripts/` + top-level `types/` still use `@living-dictionaries/types` + `@supabase/supabase-js` + `pg`.**
  `config-supabase.ts` underpins the whole import/migration pipeline (8 importers). This is out-of-pnpm-workspace
  tooling I can't run/verify, and several import scripts may be obsolete post-migration. The 5 pre-existing
  `scripts/` lint errors are from the same `packages/*`→top-level drift (eslint ignores still say `packages/scripts`).
  **Recommend a separate pass** to: decide which import scripts are still live, move `types/`→`scripts/types/`
  (or local copy) + relative imports, drop supabase-js/pg, fix eslint ignore paths. `ids-import` uses no types.
- ✅ **`linguistic_history`** — resolved, real column added (see Phase D note above).
- ✅ **Seed script un-dangled (2026-06-05):** `site/scripts/seed-achi-fixture.ts` imported deleted
  `../src/lib/mocks/{dummy-entries,mock-user}` (removed in Phase D's "dead stub mocks" sweep, but the seed
  script was the sole live consumer). Restored the fixtures as a self-contained, seed-only
  `site/scripts/achi-fixtures.ts` (co-located, not under `src/` so not app-coupled; loosely typed since the
  legacy `created_by`/`dictionary_id` shape no longer matches the Drizzle `Tables<>` — the seed maps it at
  insert time). Folded in `MOCK_USER_ID`/`MOCK_MANAGED_DICTIONARY_ID`. Dropped the now-stale
  `delete row.linguistic_history` line and seeded `e_ja` with a `linguistic_history` value so the new column is
  exercised. Verified: `pnpm -F site seed:achi-fixture` runs green against a temp `DATA_DIR` and persists the
  field; eslint clean. (Re-run `pnpm -F site seed:achi-fixture` to refresh the live `achi.db`.)
- [ ] `pnpm --filter=site test --run` → green (minus deleted supabase tests).
- [ ] `pnpm --filter=site build` + headless boot via browser-launch.mjs, assert no pageerror.
- [ ] Jacob eyeballs `:3041` (home globe, a dict, entries, entry editor, contributors, settings save).

## Deferred (future re-attempt)
- History tab + API-keys/external-API features — archived in `archive/`, need redesign on the new schema (no `content_updates`/`api_keys` tables).
