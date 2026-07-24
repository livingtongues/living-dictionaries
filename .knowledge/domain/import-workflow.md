# Running an import ourselves (insider recipe)

**The `/api/v1` guides are the source of truth for import workflow** — start every
import (even internal ones) by reading `site/src/lib/api/v1/guides/importing.md`
(+ the format guide that matches the file) and follow them exactly. Anything
generally useful learned during an import goes INTO those guides so outside
agents benefit; this page holds only the insider-only bits the public guides
can't say. First run: Enxet, 2026-07-24 (`.issues/enxet-import.md`).

## Do the import THROUGH the public API, not raw SQL

Even with full VPS access, mint a per-dict API key and drive
`https://livingdictionaries.app/api/v1` like an outsider. The v1 write path owns
the sync/seq invariants, entry_count mirror, import-tag bookkeeping, and
`import_id` rollback — hand-written SQL against dict.db has to re-earn all of
that. Insider access is for fetching bytes, verification reads, and backups.

## Insider steps around the public workflow

- **Find the request**: `shared.db.source_files` has the uploaded resources
  (instructions, `import_thread_id`, uploader) — query per the `database` skill.
- **Fetch the uploaded file**: bytes live in R2 bucket
  `livingdictionaries-attachments`, key = `source_files.storage_key`
  (`import/{dict}/{file_id}`). Creds are in the app container env
  (`docker exec sveltekit_blue printenv R2_SECRET_ACCESS_KEY` etc.); use local
  `aws s3 cp --endpoint-url https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
  (The `/files/{id}` endpoint works too once you have a key.)
- **Mint the API key**: one INSERT into `shared.db.api_keys` — replicate
  `site/src/lib/api-keys/api-key.ts` (`ldk_` + 43-char base64url of 32 random
  bytes; store only the sha-256 hex as `token_hash`, plus `token_prefix` = first
  10 chars, `last_four`, `label`, `role='write'`).
  **Attribute `created_by_user_id` to a user whose email is in
  `$lib/admins.ts`** (`jwrunner7@gmail.com`, `diego@livingtongues.org`) — the
  requested-file guard (`require_requested_file_owner`) only passes the original
  uploader or a SITE ADMIN, and jacob@livingtongues.org is NOT the admin
  account. Keep the raw token in `/tmp`, never in the repo.
- **Backup first**: `sudo cp /opt/hosting/data/dictionaries/{id}.db
  {id}.db.pre-import-bak` on the VPS (cheap; `import_id` batch-delete is the
  real rollback).
- **Verify with insider reads**: direct read-only queries against
  `/data/dictionaries/{id}.db` in the container beat paginating the API —
  counts, gloss/definition splits, and spot-check ~10 entries' full content
  against your parsed source (deterministic uuid5 ids make lookups trivial).
- **Don't trust the file extension**: Enxet's "`.db`" was a Toolbox/SFM text
  file, not SQLite. `file` + `head` before choosing a parser.
- **Report**: per Jacob's call on the first run, report to Jacob in-session
  rather than replying in the import thread (revisit as the workflow matures).
