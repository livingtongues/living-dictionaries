# Dictionary import process (Google Sheets template → SQLite)

The human + script process for importing a dictionary from the Google Sheets template. The script
internals live in `scripts/import/` — this page is the *process* (which order, which environment,
the team handoffs) that isn't in the code.

## Layout
- Put the data in `scripts/import/data/<dictionaryId>/`: the exported CSV as `<dictionaryId>.csv`,
  plus optional `images/` and `audio/` subfolders for any media the CSV references.
- The `example-v4` / `example-v4-senses` folders stay checked in as references; real dictionary
  data is gitignored (we don't want partner data in the repo).
- The script reads `import/data/<id>/<id>.csv`, strips the header row, and imports entries/senses/
  media. Media is uploaded to GCS (see `.knowledge/domain/media-serving-urls.md`).

## Steps (run from `scripts/`)
1. **Dev dry-run** — `tsx import/import.ts --id <id>` (no `--live` ⇒ logs only, uploads nothing).
   Inspect the log for missing media files / malformed rows. Tip: paste the logged entries array
   into a `.json` file and let the editor format it to comb through the data quickly.
2. **Dev live** — `tsx import/import.ts --id <id> --live`, then eyeball the imported dictionary on
   `http://localhost:3041/<id>` (or a deployed dev URL) to confirm entries + media look right.
3. **Clean up dev media** before going to prod (don't leave a half-import's media in dev).
4. **Prod live** — `tsx import/import.ts --id <id> -e prod --live` to push it to
   `livingdictionaries.app/<id>`.
5. **Hand off** — review the imported dictionary, then ask Anna to look it over and **make it
   public** once everyone's happy. (Imports land private.)

(`pnpm --filter scripts import-dictionary:dev:dry|dev:live|prod:live` are the same commands wired for
the `example-v4` fixture.)

## Notes
- The default is always a dry run — you must pass `--live` to write anything, in either environment.
- Adding a brand-new entry *field* to the importer is a separate, cross-cutting change (type +
  UI + table column + export + import parser + optional search filter). It was last documented for
  the old Supabase/`packages/*` layout and is stale — re-derive against the current `types/` +
  `site/src/lib/db/schemas/` + `scripts/import/` if you need it.
