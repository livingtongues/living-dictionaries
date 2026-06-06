# Scripts cleanup + fold `/types` away

Two coupled goals:
1. **Major cleanup of `/scripts`** — delete firebase→supabase relics, isolate the supabase→sqlite
   cutover into one subfolder we can delete after cutover.
2. **Remove the top-level `/types` package** — site already has its own `$lib/types`; the only
   remaining consumer is `scripts`. Move the supabase types into `scripts`, delete `/types`.

## Key discoveries (the "why")

- **site is fully self-sufficient.** `site/src/lib/types/` already exists (created by commit
  `bacef8a7` "consolidate types onto Drizzle"). It is a near-exact duplicate of `/types` *except*
  it has a Drizzle-based `db.ts` instead of the supabase `Database` tree. site imports **zero**
  code from `@living-dictionaries/types` (only a doc + a comment mention). → **Nothing moves into
  site.**
- **`/types` is now legacy supabase types**, consumed only by `scripts`:
  - `config-supabase.ts` → `Database` (the big supabase Postgres shape; needed for
    `createClient<Database>` + `keyof Database['public']['Tables']`)
  - `create-entry-caches/add-to-cloudflare.ts` → `EntryData, Tables`
  - `import/generate-sql-statements.ts` → `MultiString, TablesInsert`
  - `import/to-sql-string.ts` → `Database, TablesInsert`
  - `locales/update-locales.ts` → `IGlossLanguage`
  - `import/FLEx/convert*.ts` → `ActualDatabaseEntry` — **UNDEFINED everywhere** (dead firebase-era code)
  - Almost all imports are `import type` → tsx/esbuild erases them at runtime anyway.
- **Generic JSON blob type to preserve** = `export type Json` (line 1 of
  `types/supabase/generated.types.ts`). Preserved automatically by moving the supabase tree into scripts.
- **scripts is a standalone pnpm project** (own `scripts/pnpm-lock.yaml`, NOT a root-workspace member).
  It now uses `link:../site` + `link:../types` (not `workspace:`). Runs via `tsx` (no typecheck).
- **The cutover already lives in `scripts/migrate-to-sqlite/`** (untracked, added by another session).
  It only reaches out to `../config-supabase` (`postgres`); otherwise self-contained. Does NOT import
  `@living-dictionaries/types` directly.
- **Dockerfile is stale**: it `COPY packages/types/...` and `packages/scripts/...` — neither path
  exists (they're at repo root, and the root lockfile only knows importers `.` + `site`). So the
  Docker build is currently broken regardless of this task.
- **Most "ongoing" tools are still supabase-coupled** (`import-data.ts`, `create-entry-caches`,
  `download-audio`, `delete-dictionary-media`, `reset-local-db` all read supabase via
  `config-supabase`). They will break at cutover and need porting to SQLite — **out of scope here**,
  just documented.

## Plan

### A. DELETE (firebase→supabase relics + obsolete supabase type-gen tooling)
- `scripts/migrate-to-supabase/` (whole dir — imports `./firestore-data/*.json`)
- `scripts/refactor/` (whole dir — `recursive-firebase-delete.ts` [firebase, all commented],
  `tdv1-dictionaries.ts` [TD v1 firebase location data, unreferenced])
- ~~`scripts/import/FLEx/`~~ — **KEPT per Jacob** (still imports the undefined `ActualDatabaseEntry`
  + `@living-dictionaries/parts`; left dead-as-found, just repointed its types import to `../../types`).
- `scripts/import/old/` (`parseSourceFromNotes.ts` — only self-referenced)
- `scripts/merge-types.ts` + `scripts/merge-types.test.ts` (supabase type-gen tooling, obsolete)
- package.json script entries: `merge-types` (deleted file), `get-emails` (already points at a
  **nonexistent** `refactor/get-email.ts`)

### B. CUTOVER subfolder (supabase→sqlite one-time; delete after cutover)
- `scripts/migrate-to-sqlite/` already serves this. DECISION: keep name vs rename to
  `supabase-cutover/` (house uses `firebase-cutover/`). If renamed, update the 3 package.json
  entries (`migrate-to-sqlite:dry`, `migrate-to-sqlite`, `verify-migration`).
- `config-supabase.ts` + `.env.supabase` are **shared** with ongoing supabase-coupled tools, so they
  STAY at scripts root (don't move into the cutover folder). They die when supabase is fully removed.

### C. Types → into scripts, delete `/types`
- Move `/types/*` → `scripts/types/` (keep internal structure incl. `supabase/` subdir — it's
  doomed code and the name is informative; low churn, low risk).
- Repoint scripts' `@living-dictionaries/types` imports → relative (`./types` from root,
  `../types` from `create-entry-caches/`, `import/`, `locales/`). 5 live sites (FLEx ones deleted).
- Remove `"@living-dictionaries/types": "link:../types"` from scripts/package.json.
- Delete top-level `/types`.
- site untouched.
- archive/* (6 type imports) is reference-only / not built — leave broken imports as-is.

### D. Dockerfile / lockfile
- Remove `COPY packages/types/...` and `COPY packages/scripts/...` from BOTH stages.
- Root lockfile already only knows `.` + `site` → `pnpm install --frozen-lockfile` + `node build`
  should pass once Dockerfile stops referencing the nonexistent importers.

## Verify
- `cd scripts && pnpm install` (relink), then `pnpm test --run` green; `tsx` a dry import.
- `pnpm --filter=site check` still 0 errors (site untouched, sanity check).
- `pnpm install --frozen-lockfile` at root; `pnpm --filter=site build` + `node build` boots.
- `pnpm lint` on changed files.

## Out of scope (documented, not done)
- Porting supabase-coupled ongoing tools (import, create-entry-caches, download-audio,
  delete-dictionary-media, reset-local-db) to read from SQLite. Needed before they work post-cutover.

## Status — ✅ DONE
- ✅ Renamed `scripts/migrate-to-sqlite/` → `scripts/supabase-cutover/`; updated 3 package.json
  path values (command *names* kept) + verify.ts usage comment.
- ✅ `git mv types → scripts/types` (history preserved, supabase/ subtree intact). Repointed 5 live
  + 2 FLEx type imports to relative `./types` / `../types` / `../../types`. Dropped `link:../types`
  dep + removed stale `node_modules/@living-dictionaries/types` symlink. `export type Json` preserved.
- ✅ Deleted relics: `migrate-to-supabase/`, `refactor/`, `import/old/`, `merge-types.ts(+test)`.
  Removed dead `merge-types` + `get-emails` npm scripts. **FLEx kept.** Cleaned `vitest.config.ts`
  globs that pointed at deleted dirs.
- ✅ Dockerfile: dropped `packages/types` + `packages/scripts` copies (both stages); fixed
  `--filter @living-dictionaries/site` → `--filter=site`. `.dockerignore`: fixed stale `packages/*`
  paths → real root dirs (+ exclude scripts/archive/cf-worker from build context).
- ✅ Docs synced: AGENTS.md (structure + authoritative-shapes), cross-project-orchestration.md,
  database SKILL.md, pulling-supabase-data-locally.md.
- ✅ Verified: `scripts` 31 unit tests green (incl. renamed cutover + locales-via-moved-types);
  tsx smoke loads `scripts/types/index.ts`; `pnpm --filter=site check` = 0 errors; root
  `pnpm install --frozen-lockfile` clean; lint clean on changed files.

## Notes for next agent
- Command names `migrate-to-sqlite{,:dry}` / `verify-migration` were intentionally kept even though
  the folder is now `supabase-cutover/` (avoids doc churn; values point at the new path).
- `archive/*` still imports `@living-dictionaries/types` (6 files) — reference-only, not built, left as-is.
- Not pushed/committed (Jacob controls that). Joins the other sessions' pending changes.
