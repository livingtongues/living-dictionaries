---
description: Read or modify the production SQLite databases on the living VPS — both the admin shared.db and per-dict dictionaries/<id>.db files. Use for user lookups, dictionary inspection, schema queries, deletions.
---

# Production DB Operations (living)

Use this when reading or modifying production data on the living VPS. The
database is live — **always confirm what will be affected before destructive
operations**.

> **PRE-CUTOVER NOTE.** Until cutover (`.issues/cutover-runbook.md`), old prod
> is Supabase, not the VPS. This command targets the new VPS once it's serving.

## Infrastructure

| | Living |
|---|---|
| SSH alias | `living` |
| Domain | `new.livingdictionaries.app` (flips to apex `livingdictionaries.app` at cutover) |
| Shared DB (host) | `/opt/hosting/data/shared.db` |
| Per-dict DBs (host) | `/opt/hosting/data/dictionaries/<dict_id>.db` |
| Attachments | `/opt/hosting/data/files/<message_id>/<attachment_id>/<filename>` (admin email inbox attachments, R2-backed in production) |

### Docker mount mapping
The container's `/workspace/site/.data` is bind-mounted to host
`/opt/hosting/data`. So inside the `sveltekit` container, the shared DB is at
`/workspace/site/.data/shared.db` and per-dict DBs are at
`/workspace/site/.data/dictionaries/<dict_id>.db`.

### Databases

LD has **TWO classes** of DB on the server, unlike house's single shared.db:

- **`shared.db`** — admin-visible global catalog: `users`, `email_aliases`,
  `dictionaries`, `dictionary_roles`, `dictionary_partners`, `invites`,
  `message_threads`, `messages`, `message_attachments`, `email_codes`,
  `client_logs`, sync tombstones (`deletes`), `migrations`, `db_metadata`. Drizzle
  schema: `site/src/lib/db/schemas/shared.ts`. DDL: `shared-migrations/*.sql`.
- **`dictionaries/<dict_id>.db`** — per-dictionary content: `entries`, `senses`,
  `sentences`, `senses_in_sentences`, `audio`, `photos`, `videos`, `speakers`,
  `tags`, `dialects`, `texts`, etc. Drizzle: `site/src/lib/db/schemas/dictionary.ts`.
  DDL: `dictionary-migrations/*.sql`. Each dict carries its own `migrations` table
  + `db_metadata.dict_db_schema_version`.

Editors sync just their dictionaries (per-dict SharedWorker + R2 snapshot).
Admins sync the shared catalog only — per-dict DBs are NOT in admin sync. To
inspect entries you query the relevant per-dict DB directly.

## Tooling

**`sqlite3` CLI is NOT installed on the VPS host.** Query via the `sveltekit`
Docker container using `better-sqlite3` through Node:

```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, email FROM users WHERE email = ?\").all(\"someone@gmail.com\"), null, 2));
"'
```

Key points:
- Container path is `/workspace/site/.data/...`, NOT `/data/...` or `/opt/hosting/data/...`
- Use `{ readonly: true }` whenever possible
- Escape quotes carefully — SSH double-quotes + shell escaping inside `docker exec`
- Per-dict DBs: same pattern, swap the path to `/workspace/site/.data/dictionaries/<dict_id>.db`

## Safety rules — ALWAYS FOLLOW

1. **Before any destructive op**, run a read-only query first to confirm the
   user/dict/data you're targeting. Echo back: id, email/name, created_at, what
   will be deleted/modified, and how many rows.
2. **Never touch `shared.db.users`** unless explicitly told "delete the
   account" — and even then, prefer `INSERT INTO deletes` (the sync-tombstone
   path) over raw `DELETE` so admin clients also drop the row on next sync.
3. **Never run raw `DELETE FROM ...` without a `WHERE` clause**, and never run
   `DROP TABLE` without per-command confirmation.
4. **Per-dict DB writes propagate to clients via the R2 snapshot**, not sync —
   so a write on the VPS won't appear in editors' browsers until the next
   builder run (cron, ~30 min) OR a manual rebuild
   (`bin/build-all-snapshots.ts --dict-id=<id>`). Tell the user when this lag
   applies.
5. **For schema changes** (ALTER TABLE, CREATE INDEX, raw migration), **stop
   the container first** to avoid WAL corruption:
   ```bash
   ssh living 'docker stop sveltekit'
   # run schema change via docker run -v /opt/hosting/data:/data alpine sh -c 'apk add sqlite && sqlite3 /data/shared.db "ALTER TABLE ..."'
   ssh living 'docker start sveltekit'
   ```
   Better: write a proper migration file in `shared-migrations/` or
   `dictionary-migrations/`, deploy, let `hooks.server.ts` apply it on boot.
6. **Back up before destructive ops** that touch `shared.db` or a high-value
   per-dict DB:
   ```bash
   # See backup-vps-db.md for the full R2 backup pattern.
   # Quick local-snapshot alternative for ad-hoc work:
   ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
   ```

## Common operations

### Look up a user by email
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, email, name, admin_level, created_at, last_visit_at FROM users WHERE email = ?\").all(\"EMAIL_HERE\"), null, 2));
"'
```

### Look up a dictionary by url-slug or id
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, name, url, public, created_at, entry_count FROM dictionaries WHERE id = ? OR url = ? LIMIT 1\").all(\"SLUG\", \"SLUG\"), null, 2));
"'
```

### Roles on a dictionary
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
const rows = db.prepare(\`
  SELECT u.email, u.name, dr.role, dr.created_at
  FROM dictionary_roles dr JOIN users u ON u.id = dr.user_id
  WHERE dr.dictionary_id = ? ORDER BY CASE dr.role WHEN '"'"'manager'"'"' THEN 1 WHEN '"'"'editor'"'"' THEN 2 ELSE 3 END
\`).all(\"DICT_ID\");
console.log(JSON.stringify(rows, null, 2));
"'
```

### Count entries in a per-dict DB
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/dictionaries/DICT_ID.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT COUNT(*) AS n FROM entries\").get(), null, 2));
"'
```

### Inspect a single entry
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/dictionaries/DICT_ID.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT * FROM entries WHERE id = ?\").get(\"ENTRY_ID\"), null, 2));
"'
```

### Recent message threads (admin inbox)
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, from_email, subject, last_message_at, resolved_at FROM message_threads ORDER BY last_message_at DESC LIMIT 10\").all(), null, 2));
"'
```

### Check migration state — shared.db
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, run_on FROM migrations ORDER BY id\").all(), null, 2));
"'
```

### Check migration state — a per-dict DB
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/dictionaries/DICT_ID.db\", { readonly: true });
console.log(JSON.stringify(db.prepare(\"SELECT id, run_on FROM migrations ORDER BY id\").all(), null, 2));
console.log(JSON.stringify(db.prepare(\"SELECT key, value FROM db_metadata WHERE key = '"'"'dict_db_schema_version'"'"'\").all(), null, 2));
"'
```

If a dict's reported `dict_db_schema_version` lags the bundle's latest, the
boot sweep in `hooks.server.ts` will upgrade it next start. If it's AHEAD (a
downgrade), open the DB rejects writes — investigate before forcing.

### Recent client_logs errors (last 24h)
See `scan-and-fix-errors.md` for the full triage workflow. The telemetry
pipeline (`remote-log.ts` → `/api/log` → `client_logs`) is live; production
rows accumulate once the VPS is serving traffic.

### Resolve / re-open a thread by id
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\");
const now = new Date().toISOString();
db.prepare(\"UPDATE message_threads SET resolved_at = ?, resolved_by_user_id = NULL, updated_at = ?, dirty = 1 WHERE id = ?\").run(now, now, \"THREAD_ID_HERE\");
console.log(\"ok\");
"'
```

Note `dirty = 1` so admin clients pick up the change on next sync.

### Hard-delete a thread (and its messages + attachments via cascade)
Use the deletes-table path:
```bash
ssh living 'docker exec sveltekit node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(\"/workspace/site/.data/shared.db\");
db.prepare(\"INSERT INTO deletes (table_name, id) VALUES (?, ?)\").run(\"message_threads\", \"THREAD_ID_HERE\");
console.log(\"deleted\");
"'
```

Attachment **bytes** on disk (`/opt/hosting/data/files/<message_id>/...`) are
NOT auto-cleaned. Sweep periodically with a script that diffs
`message_attachments.storage_key` vs filesystem entries.

## Pulling a copy of a DB to local

```bash
# shared.db — read-only inspection (WAL mode allows readers)
ssh living 'sudo cp /opt/hosting/data/shared.db /tmp/shared.db && sudo chown $USER:$USER /tmp/shared.db'
scp living:/tmp/shared.db /tmp/living-shared.db
sqlite3 /tmp/living-shared.db ".tables"

# A specific per-dict DB
ssh living 'sudo cp /opt/hosting/data/dictionaries/DICT_ID.db /tmp/DICT_ID.db && sudo chown $USER:$USER /tmp/DICT_ID.db'
scp living:/tmp/DICT_ID.db /tmp/
```

For a hot-consistent snapshot under heavy write load, use the online backup API
(see `backup-vps-db.md`).

## Schema source of truth

- DDL: `site/src/lib/db/schemas/{shared,dictionary}-migrations/*.sql` (date-prefixed, applied in sort order, tracked per-DB in `migrations` table)
- Drizzle types (for TS): `site/src/lib/db/schemas/{shared,dictionary}.ts` — types only, NOT used to generate migrations
- Sync sectors: `site/src/lib/db/sync/types.ts` — `SYNCABLE_TABLE_NAMES` defines what admin clients receive

`client_logs`, `email_codes`, `email_aliases`, `deletes`, `migrations`, `db_metadata` are server-only (not in `SYNCABLE_TABLE_NAMES`).

## Related commands

- `debug-vps.md` — container / Caddy / deploy / env-var ops
- `backup-vps-db.md` — proper online-backup → R2 before destructive ops
- `scan-and-fix-errors.md` — `client_logs` bug triage (pipeline live; prod rows once deployed)
