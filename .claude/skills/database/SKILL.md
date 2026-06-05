---
name: database
description: Database guidelines for LD's shared.db (admin/global catalog) + per-dict dictionaries/<id>.db (content), wa-sqlite in browsers + better-sqlite3 on the VPS, sync engines, and live reactive UI data.
---

## When to use me

When working with databases in the new `site/` package: schema design, queries
(client-side via LiveDb, server-side via better-sqlite3), migrations, sync,
live-reactive data in Svelte components.

> The root `AGENTS.md` has a comprehensive **UI Database Interaction using
> Live PGlite** section that documents the LiveDb API in full (rows, objects,
> id-lookup, insert/upsert/update/delete, queries, snapshots, row methods,
> `_save` / `_delete` / `_reset`). It applies as-written to LD's
> wa-sqlite-backed LiveDb — the "PGlite" in the heading is a holdover but the
> API is identical. **Read it for component-level patterns**; this skill
> covers the architecture and the LD-specific schema knowledge.

## Style

- Use **ALLCAPS** for SQL keywords (`SELECT`, `FROM`, `WHERE`, `INSERT`,
  `UPDATE`, `DELETE`). Supabase / Drizzle tooling often lowercases — fix it
  when you see it.
- Use the typed Drizzle schema for TS types
  (`import { users, type User } from '$lib/db/schemas/shared'`), but **NOT**
  for migrations — migrations are raw SQL files (see Migrations below).

## Two database classes — the most important thing to remember

LD splits its data across two SQLite database classes. They DO NOT share the
same sync engine, the same browser-side accessor, or the same write path.
Knowing which database you're touching dictates everything else.

### `shared.db` — global admin catalog
| | |
|---|---|
| **Server location** | `site/.data/shared.db` (dev) / `/opt/hosting/data/shared.db` (VPS) |
| **Server access** | `get_shared_db()` from `$lib/db/server/shared-db.ts` (better-sqlite3) |
| **Drizzle schema** | `$lib/db/schemas/shared.ts` |
| **Migrations** | `$lib/db/schemas/shared-migrations/*.sql` (date-prefixed) |
| **Browser mirror** | Admins-only, in wa-sqlite (IDB-backed). Mounted at `page.data.db` inside `/admin/*` routes via `$lib/db/client/live/`. |
| **Sync engine** | `$lib/db/sync/engine.svelte.ts` — admin downloads syncable subset, uploads admin-side mutations (thread resolves/replies/etc). |

**Syncable tables** (see `lib/db/sync/types.ts` `SYNCABLE_TABLE_NAMES`):
`users`, `dictionaries`, `dictionary_roles`, `dictionary_partners`, `invites`,
`message_threads`, `messages`, `message_attachments`.

**Server-only** (not in admin sync): `email_codes`, `email_aliases`,
`client_logs`, `migrations`, `db_metadata`, `deletes`.

### `dictionaries/<dict_id>.db` — per-dictionary content
| | |
|---|---|
| **Server location** | `site/.data/dictionaries/<id>.db` (dev) / `/opt/hosting/data/dictionaries/<id>.db` (VPS) |
| **Server access** | `get_dictionary_db(dict_id)` from `$lib/db/server/dictionary-db.ts` (better-sqlite3, on demand). Also `open_dictionary_db_in_memory(dict_id)` for tests. |
| **Drizzle schema** | `$lib/db/schemas/dictionary.ts` |
| **Migrations** | `$lib/db/schemas/dictionary-migrations/*.sql` (date-prefixed, applied per-DB) |
| **Browser mirror** | One per dict, in wa-sqlite (OPFS-backed) inside a **SharedWorker** (`$lib/db/dict-client/shared-worker.ts`), exposed via `DictLiveDb` (`dict-live-db.svelte.ts`). |
| **Read path** | R2 snapshot (`snapshots.livingdictionaries.app/<id>.db.gz`) seeds the OPFS file; `/api/dictionary/[id]/changes` applies any deltas newer than the snapshot. |
| **Write path** | Editor mutations → `/api/dictionary/[id]/db` (gated by `verify_auth_dict_role`). A cron-driven snapshot builder rebuilds the R2 `.db.gz` periodically. |

**Tables**: `entries`, `senses`, `sentences`, `senses_in_sentences`,
`speakers`, `audio`, `audio_speakers`, `videos`, `video_speakers`,
`sense_videos`, `sentence_videos`, `photos`, `sense_photos`,
`sentence_photos`, `dialects`, `entry_dialects`, `tags`, `entry_tags`,
`texts`, plus per-DB `migrations` + `db_metadata` (carries
`dict_db_schema_version`).

**Sentence ordering** uses a fractional `sort_key TEXT` (LexoRank-style) +
`ends_paragraph` flag — see `.knowledge/decisions/texts-sentence-ordering.md`.

### Why split

- A 50,612-entry dictionary's data shouldn't ride the catalog around to every
  admin. Per-dict isolation keeps each user's offline working-set small.
- R2 snapshots make first-load fast even for the biggest dicts.
- Editor writes go server-direct (no inter-client conflict because there's a
  single writer authority).
- The catalog stays compact enough for the admin to fully mirror locally for
  a reactive UI.

## Auto-parse driver contract (JSON columns)

**Rule:** `text({ mode: 'json' }).$type<T>()` in Drizzle IS the runtime JS
type on both client and server. JSON columns are always parsed objects in JS,
never hand-stringified.

- **Reads**: every path that returns rows from SQLite runs `parse_row(table, row)`.
  - **Server**: use `query_all` / `query_one` from `$lib/db/server/typed-query.ts`.
  - **Client**: the TableStore in `$lib/db/client/live/` and dict-client
    equivalents handle this automatically.
- **Writes**: every path that inserts/updates calls `stringify_row(table, { ...row })`
  once at the top. Do NOT pre-stringify JSON columns yourself —
  `stringify_row` encodes everything (a JS string `"hello"` must be stored as
  `"hello"` with quotes to be valid JSON storage).
- **Escape hatch**: raw `db.prepare(...)` is fine for aggregates / `PRAGMA` /
  migrations. Use the typed helpers for anything returning table rows.

JSON column maps: `$lib/db/schemas/json-columns.ts` (shared.db) and
`$lib/db/schemas/dictionary-json-columns.ts` (dict.db).

## Migrations

Raw SQL files, **NOT generated from Drizzle**. The Drizzle schema is for TS
types only; SQL is the source of truth.

### Where they live
- shared.db: `$lib/db/schemas/shared-migrations/<YYYYMMDD>_<name>.sql`
- dict.db: `$lib/db/schemas/dictionary-migrations/<YYYYMMDD>_<name>.sql`

### How they apply
- **Server boot**: `hooks.server.ts` runs all pending shared-migrations on
  the singleton shared.db. It also boot-sweeps every per-dict DB, applying
  any pending dictionary-migrations and bumping `db_metadata.dict_db_schema_version`.
- **Client (admin shared.db mirror)**: runs the migrations bundle on first
  open. Mirrors only what the sync engine will populate (server-only tables
  like `client_logs` are created empty client-side but stay empty).
- **Client (per-dict)**: the snapshot it pulls from R2 is already at a known
  schema version. The SharedWorker compares the snapshot's stamped
  `dict_db_schema_version` against the bundled migrations and applies any
  newer ones locally.

### Writing a migration
1. Add a new file `<YYYYMMDD><letter>_<name>.sql` (letter suffix for ordering within a day) in the appropriate `*-migrations/` dir.
2. Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, idempotent `ALTER TABLE` where SQLite supports it (it doesn't ADD CONSTRAINT or DROP COLUMN well — plan accordingly).
3. Update the Drizzle schema (`shared.ts` / `dictionary.ts`) to match.
4. For dict-migrations: bump the latest version sentinel that the boot sweep
   stamps on every dict catalog row (see `dict_db_schema_version` handling in
   the migration script + hooks).
5. Add a test under `lib/db/server/` if the change is invasive.

### CRITICAL: migration discipline for dict.db
Because per-dict snapshots live in R2 with a stamped schema version, an
incompatible mid-flight migration would strand editors holding the old
snapshot. The boot-sweep logic ensures every dict catalog row gets the new
`dict_db_schema_version` before the snapshot builder rebuilds — DO NOT skip
the migration-script update when introducing a new dict-migration. See
`.knowledge/architecture/db-sync-architecture.md` and
`.knowledge/architecture/supabase-to-sqlite-migration.md` for the full story.

## Server-side queries

```ts
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { query_all, query_one } from '$lib/db/server/typed-query'
import { users, type User } from '$lib/db/schemas/shared'
import { entries, type Entry } from '$lib/db/schemas/dictionary'

// shared.db
const user = await query_one(get_shared_db(), users,
  'SELECT * FROM users WHERE email = ?', [email])

// dict.db
const db = get_dictionary_db(dict_id)
const entry = await query_one(db, entries,
  'SELECT * FROM entries WHERE id = ?', [entry_id])
```

`query_one` / `query_all` apply `parse_row` so JSON columns come back as
objects. Plain `db.prepare(...).get()` works fine for aggregates or other
cases where you don't need row parsing.

For mutations, `stringify_row(table, row)` before insert/update so JSON
columns get encoded once at the boundary:

```ts
import { stringify_row } from '$lib/db/schemas/json-columns'

const row = stringify_row(users, { id, email, name, providers: [...], ... })
db.prepare('INSERT INTO users (...) VALUES (...)').run(row.id, row.email, ...)
```

## Client-side reactive data (LiveDb)

`page.data.db.<table>` gives reactive, mutate-then-`_save()` access to the
admin shared.db mirror inside `/admin/*` routes.

For per-dict content, the dict-client equivalent is **`DictLiveDb`** — same
API shape (rows/objects/query/insert/upsert/update/delete + `_save / _delete
/ _reset`), constructed from a `DictConnection` opened via the SharedWorker.
See `/test/dict-sync/[id]/+page.svelte` for the current provisional pattern:

```ts
import { create_dict_live_db } from '$lib/db/dict-client/dict-live-db.svelte'
import { open_dict } from '$lib/db/dict-client/shared-worker-lifecycle'

const connection = await open_dict({ dict_id, has_editor_role: true })
const live_db = create_dict_live_db(connection)
// then in markup: live_db.entries.rows / live_db.entries.id(entry_id) / etc.
```

The `/[dictionaryId]` epic +layout will own the connection lifecycle (open
on enter, close on leave, retain across nested route navigations) — the
exact `page.data` shape for dict-routes hasn't been decided yet. Refer to
the epic planning interview in `port-living-dictionaries.md` T1 once it's
been run.

The **API is the same** for both: `.rows`, `.objects`, `.id(some_id)`,
`.query({ where, params, order_by, limit, offset })`, `.insert()`,
`.upsert()`, `.update()`, `.delete()`, row methods `_save() / _delete() /
_reset()`, query `.snapshot()` for non-reactive one-time reads.

Full API documentation (including the "**don't spread rows**" rule that
breaks reactivity) is in the root `AGENTS.md`. Read that before working with
LiveDb in components — this skill won't duplicate it.

### Pitfall reminders

- **Don't spread or copy rows** (`[...rows]`, `{...row}`, `.map()`,
  `.filter()`, `.sort()`, `.reverse()`, `Array.from()`). These break
  reactivity AND strip the `_save / _delete / _reset` methods. Use
  `.query({ where, order_by, limit, offset })` for any
  filtering/sorting/paginating.
- **Don't `await page.data.db.users.objects[id]`** — `.objects` is a sync
  reactive store, not a promise. Use `.find()` for an async non-reactive
  lookup instead.
- **Updates need `_save()`.** Mutating a row property updates the UI
  optimistically (reactive `$state`) but does NOT write to the DB until you
  call `_save()`.
- **`.id(some_id)` creates a single-row subscription** (efficient — doesn't
  re-fire when other rows change). Use it when a component only cares about
  one specific row.

## Sync engines (read this when touching sync code)

- **Admin shared.db sync**: `$lib/db/sync/engine.svelte.ts` (client) +
  `lib/db/server/sync-helpers.ts` (server). Sector-based; tracks watermarks
  in `db_metadata`. Dirty rows uploaded, server rows pulled by sector.
- **Per-dict sync**: `$lib/db/dict-client/dict-sync-engine.ts` is much
  simpler — snapshot-as-of-build + change-since-snapshot fetch on connect.
  No bidirectional sync per dict; editors' writes go through the `/db`
  endpoint, which the snapshot builder eventually reflects in R2.

Background:
`.knowledge/architecture/db-sync-architecture.md`,
`.knowledge/architecture/supabase-to-sqlite-migration.md`.

## Folder map (cheat-sheet)

```
$lib/db/
  schemas/
    shared.ts                          Drizzle types for shared.db
    shared.types.ts                    Derived types
    shared-migrations/                 Raw SQL migrations (server + client)
    dictionary.ts                      Drizzle types for per-dict DBs
    dictionary.types.ts                Derived types
    dictionary-migrations/             Raw SQL migrations
    json-columns.ts                    parse_row/stringify_row for shared.db
    dictionary-json-columns.ts         Same for dict.db
  client/                              Admin shared.db mirror (wa-sqlite, IDB)
    connection.ts                      SqliteConnection wrapper
    db.ts                              Boot + apply migrations
    live/                              LiveDb reactive store
  dict-client/                         Per-dict (wa-sqlite, OPFS, SharedWorker)
    shared-worker.ts                   The worker entry
    shared-worker-lifecycle.ts         Lifecycle helpers
    dict-connection.ts                 Connection wrapper inside the worker
    dict-live-db.svelte.ts             DictLiveDb reactive store
    dict-sync-engine.ts                Snapshot + changes-since
    fetch-snapshot.ts                  R2 snapshot fetch
    opfs-vfs-loader.ts                 OPFS VFS for wa-sqlite
    opfs-lru.ts                        LRU eviction for offline storage
    rpc-types.ts                       Client ↔ worker message shapes
    dict-migrations-bundle.ts          Bundled migrations for client-side apply
  server/
    shared-db.ts                       better-sqlite3 shared DB singleton (get_shared_db, open_shared_db)
    dictionary-db.ts                   Per-dict DB connection pool (get_dictionary_db, close_*, open_dictionary_db_in_memory)
    sync-helpers.ts                    process_sync admin sector engine
    dictionary-sync-helpers.ts         Per-dict push/changes helpers
    r2-snapshot-builder.ts             Cron-driven snapshot rebuilder
    typed-query.ts                     query_all / query_one (parse_row applied)
    run-sql-migrations.ts              Migration runner
  sync/
    engine.svelte.ts                   Client admin sync engine
    history.svelte.ts                  Sync run history
    types.ts                           SYNCABLE_TABLE_NAMES, sector definitions
  introspect.ts                        Schema introspection used by /admin/schema
```

## Common gotchas

- **`dict_db_schema_version` MUST be stamped LATEST** on every catalog row
  before the snapshot builder runs against it — else the boot sweep tries to
  migrate every dict on every boot. The migration script handles this; if
  you script ad-hoc inserts, do the same.
- **OPFS first-write race** — first connect to a per-dict DB writes the
  snapshot; a second tab connecting in the same instant can race. The
  SharedWorker pattern serializes this within a browser, but watch for
  cross-tab edge cases.
- **`storage_path` is a path, not a URL** — media (audio/photos/videos) was
  preserved verbatim from Supabase storage in the migration. Resolve to the
  GCS / R2 / serving URL at render time, don't store URLs in the DB.
- **Drizzle migrations are NOT used** — only the raw SQL files are. Don't
  run `drizzle-kit generate`; it would emit untracked migrations.
- **For inspect / debug in dev**, see `.claude/commands/prod-db.md` for the
  ssh + docker-exec pattern (applies post-cutover) and the `/admin/schema`
  route for a live introspection UI.

## Cross-references

- API-endpoint patterns (auth + tests): `.claude/skills/api-endpoint/SKILL.md`
- UI conventions for LiveDb in components: root `AGENTS.md` "UI Database Interaction"
- Architecture deep-dives: `.knowledge/architecture/`
- Decision records: `.knowledge/decisions/`
- Migration script (Supabase → SQLite cutover): `.knowledge/architecture/supabase-to-sqlite-migration.md` + `packages/scripts/migrate-to-sqlite/`
