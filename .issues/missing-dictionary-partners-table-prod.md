# P1 — production shared.db is missing the `dictionary_partners` table → `/api/admin-sync` 500s

**Found by:** the 2026-06-29 `log-and-fix` review (first real-traffic day).
**Severity:** 🔴 P1 — server `crash`, breaks admin sync (a core admin flow) on the live VPS.

## Symptom

One `crash`-level, `source='server'` row on 2026-06-29T09:36:45Z:

```
no such table: dictionary_partners
SqliteError ... at query_all (typed-query) → fetch_changes → process_sync → POST /api/admin-sync
context: { route: '/api/admin-sync', path: '/api/admin-sync', status: 500 }
```

Hit by Jacob's admin session (`jwrunner7@gmail.com`) during a normal admin-sync pull.

## Root cause (confirmed against the live DB)

The production VPS `shared.db` **does not contain the `dictionary_partners` table at all**:

- `SELECT name FROM sqlite_master WHERE name LIKE '%partner%'` → `[]`.
- Yet `migrations` records `20260525_initial.sql` as **applied** — and that file
  (`site/src/lib/db/schemas/shared-migrations/20260525_initial.sql:174`) contains
  `CREATE TABLE IF NOT EXISTS dictionary_partners (...)`.

The live `migrations` table also lists **`20260526_messages.sql`**, a file that **no longer exists in
the repo** (`git log --all` finds no such path). So the production DB was provisioned from an *older*
migration set (separate `20260525_initial` + `20260526_messages`), and the repo was later
**consolidated** — `dictionary_partners` (and the messages tables) were folded into a rewritten
`20260525_initial.sql`. Because migrations run **once per name**, editing an already-applied migration
never re-executes → the new `CREATE TABLE` never ran on the live DB.

`dictionary_partners` is in `SYNCABLE_TABLE_NAMES` (`src/lib/db/sync/types.ts:36`), so every
`process_sync` pull that reaches `fetch_changes` for that table throws `no such table` → 500. It only
fired **once** today because `fetch_changes` is only reached on a real pull past the cursor for that
table (the `cursor==watermark` fast-bail skips it otherwise) — but it will recur and **silently break
admin sync** whenever partner rows need pulling, and it blocks the partners feature entirely.

## Fix (a NEW dated migration — do NOT edit the applied `20260525_initial.sql`)

Add `site/src/lib/db/schemas/shared-migrations/20260629b_dictionary_partners_backfill.sql` that
re-creates the table + indexes idempotently (safe on DBs that already have it via the consolidated
initial):

```sql
CREATE TABLE IF NOT EXISTS dictionary_partners (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_storage_path TEXT,
  photo_serving_url TEXT,
  dirty INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_dictionary_partners_dict ON dictionary_partners(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_partners_updated_at ON dictionary_partners(updated_at);
```

Run by both the server (against `shared.db`) and every admin client (against its wa-sqlite DB) via the
normal `migrations`-table mechanism. `IF NOT EXISTS` makes it a no-op on healthy DBs.

### ⚠️ Audit for siblings before shipping

The consolidation likely dropped the **same table + the `db_metadata` AFTER DELETE trigger arm** that
references `dictionary_partners` (`20260525_initial.sql:326`) — and possibly the **messages** tables
that the vanished `20260526_messages.sql` created. Before writing the migration, diff the live
`sqlite_master` (tables + triggers) against what the consolidated `20260525_initial.sql` expects, and
backfill **every** missing object, not just this one table. Query the live schema with:

```bash
cat > /tmp/schema.js <<'EOF'
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
console.log(JSON.stringify(db.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','trigger') ORDER BY type,name").all(), null, 2))
EOF
ssh living 'docker exec -i sveltekit_blue node' < /tmp/schema.js
```

## Hardening (follow-ups)

- **Make `process_sync` resilient to a missing syncable table** — a single absent table shouldn't 500
  the entire admin sync. Catch `no such table` per-table in `fetch_changes`, `log_server_event` it,
  and skip (degraded, not dead).
- **Schema-drift guard** (see the dashboard backlog Phase C item): on boot / at `/admin/analytics`
  load, assert every `SYNCABLE_TABLE_NAMES` table exists in `shared.db`; surface missing ones loudly
  so consolidation drift is caught before a user hits a 500.
</content>
</invoke>
