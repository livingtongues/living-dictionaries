# Pulling prod Supabase data into local dict DBs

How to refresh `site/.data` with real dictionary content while we're pre-cutover. The
read layer + seeding rationale is in [m4-sqlite-read-layer.md](./m4-sqlite-read-layer.md);
this page is the operational "how do I pull N dictionaries down to look around" runbook +
the gotchas that aren't obvious from the code.

## Run the pull from the EXAMPLE repo, not this one
The Supabase→SQLite migrator lives at
`~/code/living-dictionaries-example/packages/scripts/migrate-to-sqlite/` (entry
`migrate.ts`). **Run it there**, targeting this repo's data dir:

```bash
cd ~/code/living-dictionaries-example/packages/scripts
pnpm migrate-to-sqlite \
  --data-dir ~/code/living-dictionaries/site/.data \
  --content-dicts matukar,gta,apatani,nukuoro
```

Why not run it from this repo's own `scripts/`? Because this repo's `scripts/package.json`
declares `workspace:` deps (`@living-dictionaries/site`, `@living-dictionaries/types`) but
`scripts/` is **not** in `pnpm-workspace.yaml` (only `site` is), and its `node_modules` is
nearly empty — so a standalone `pnpm install` can't resolve the `workspace:` protocol.
Untangling that (the real cutover task) is deferred in `.issues/supabase-removal.md`. The
example repo's `packages/scripts` is a proper workspace member, fully installed, with the
prod creds wired (`config-supabase.ts` reads `../old-site/.env.production.local` →
`~/.secrets.d`; `-e prod` → `aws-0-us-west-1.pooler.supabase.com` w/ `SUPABASE_DB_PASSWORD`).

## Flags worth knowing (`migrate.ts`)
- `--content-dicts a,b,c` — full catalog + ALL users into `shared.db`, **content** only for
  this subset. Good for a populated globe with a few browsable dicts.
- `--dict-id X` / `--limit N` — scope the catalog too (no full catalog).
- `--dry` — lists what would migrate (but see the stdout gotcha below).
- `open_dict_db({ rebuild: true })` **drops + recreates** each migrated dict's `.db`, so
  re-pulling a dict that already exists locally overwrites it (and any manual ALTERs).

## Post-pull: two reconciliations vs THIS repo's schema
Example-built DBs are byte-compatible with this repo **except**:
1. **`linguistic_history` column is missing.** The example dropped it from its `entries`
   schema + `map_entry`; this repo re-added it (2026-06-05). Add it back on each freshly
   pulled dict db:
   ```bash
   sqlite3 site/.data/dictionaries/<id>.db \
     "ALTER TABLE entries ADD COLUMN linguistic_history TEXT;"
   ```
   (No data is lost — see below, prod barely uses the field.)
2. **`20260605_fix_lmod_triggers.sql` isn't applied.** The example only has
   `20260525_initial.sql`; pulled DBs record just that in their `migrations` table. This
   repo's app **auto-applies** the trigger fix on first open (idempotent DROP/CREATE), so no
   manual step — but it's why `dict_db_schema_version` in `shared.db` reads
   `20260525_initial.sql` for these (matches the pre-existing torwali/etc. DBs; harmless).

## Gotchas
- **`process.exit(0)` truncates piped stdout.** `migrate.ts` ends with
  `main().then(() => process.exit(0))`; when stdout is a pipe/file (not a TTY) the final
  `console.info` lines (the per-dict summary, the `--dry` list) are cut off. The work still
  completes (DBs persist, exit 0). **Verify via `sqlite3`, not the captured log.** A PTY
  (`script -qec`) didn't help in the sandbox; for a quick listing, write a tiny script that
  exits *naturally* (no `process.exit`) so stdout flushes.
- **`linguistic_history` is essentially empty in prod.** A full scan found only `learning-irish`
  and `test-004` (1 entry each) populate it — every real dictionary has 0. So the new column
  is structurally correct but you won't see data in it from a pull; exercise it via the editor
  or the achi seed fixture.
- **Media files are not pulled** — only photo/audio/video *rows* (metadata). Images/audio will
  404 in the UI until the media milestone; the data structure itself is all there.
- Pulling refreshes `shared.db`'s full catalog (~2158 dicts / ~5083 users) via upsert; the
  dev-only `achi` seed (role on `MOCK_USER_ID`, not a prod dict) survives untouched.
