---
name: database
description: SQLite Database skill for LD's admin shared.db + per-dict dictionaries/<id>.db (content) — how to WRITE DB/sync/schema/migration code AND how to READ/query the live local and production VPS databases (user/dictionary lookups, schema state, edits). wa-sqlite in browsers + better-sqlite3 on the VPS, sync engines, schema, migrations, queries, live reactive UI data.
---

## Guidelines

- All timestamps stored as ISO 8601 strings: `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` for defaults
- Use the typed Drizzle schema for TS types (`import { users, type User } from '$lib/db/schemas/shared'`), but **NOT** for migrations — migrations are raw SQL files (see Migrations below).

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
`client_logs`, `migrations`, `db_metadata`, `deletes`, `log_daily_metrics`,
`log_daily_sessions`.

> **Telemetry storage (2026-07-05):** raw `client_logs` rows were split OUT of
> `shared.db` into their own server-only **`logs.db`** (`$lib/db/server/logs-db.ts`,
> code-created, boot-time `split_client_logs_from_shared`), aging into
> `logs-archive.db`. The forever rollups (`log_daily_metrics` +
> `log_daily_sessions`) stay in `shared.db` so backups/dev pulls keep dashboard
> history without the raw-log bytes; neither raw file is backed up. See the
> **check-logs** skill. `client_logs` is still created (empty) on admin clients
> by the migration but never syncs.

> **Non-admins never get a browser shared.db.** A manager editing dictionary
> settings has no local catalog mirror — those writes go through an **API
> endpoint → shared.db** (`api_dictionaries_catalog` → `update_dictionary` in
> the `[dictionaryId]` layout, then `invalidate`). That's correct; don't try to
> convert catalog edits to mutate-then-save.

### `dictionaries/<dict_id>.db` — per-dictionary content
| | |
|---|---|
| **Server location** | `site/.data/dictionaries/<id>.db` (dev) / `/opt/hosting/data/dictionaries/<id>.db` (VPS) |
| **Server access** | `get_dictionary_db(dict_id)` from `$lib/db/server/dictionary-db.ts` (better-sqlite3, on demand). Also `open_dictionary_db_in_memory(dict_id)` for tests. |
| **Drizzle schema** | `$lib/db/schemas/dictionary.ts` |
| **Migrations** | `$lib/db/schemas/dictionary-migrations/*.sql` (date-prefixed, applied per-DB) |
| **Browser mirror** | One per dict, in wa-sqlite **OPFS in a leader-elected dedicated worker** (`$lib/db/dict-client/dict-instance.ts`, harness in `dict-client/worker/`; opened via `dict-lifecycle.ts` `open_dict`), exposed via `DictLiveDb` (`dict-live-db.svelte.ts`) over the `worker-connection.ts` shim. Mounted at **`page.data.dict_db`** for all `[dictionaryId]/*` routes. One leader per dict (keyed by `dict_id`); other tabs are followers over a BroadcastChannel. See `.knowledge/migration/opfs-leader-worker-dict-db.md`. |
| **Read path** | R2 snapshot (`snapshots.livingdictionaries.app/<id>.db.gz`) seeds the OPFS file; `/api/dictionary/[id]/changes` applies any deltas newer than the snapshot. |
| **Write path** | Editor mutations → `dict_db` (dirty rows) → the leader worker's sync engine pushes to `/api/dictionary/[id]/changes`; editors fetch their fresh snapshot from `/api/dictionary/[id]/db` (gated by `verify_auth_dict_role`). A cron-driven snapshot builder rebuilds the R2 `.db.gz` periodically. **Snapshots must ship a rollback-journal header (`journal_mode = DELETE`) — the single-file OPFS VFS can't open a WAL-mode header.** |

**Tables**: `entries`, `senses`, `sentences`, `senses_in_sentences`,
`speakers`, `audio`, `audio_speakers`, `videos`, `video_speakers`,
`sense_videos`, `sentence_videos`, `photos`, `sense_photos`,
`sentence_photos`, `dialects`, `entry_dialects`, `tags`, `entry_tags`,
`texts`, plus per-DB `migrations` + `db_metadata` (carries
`dict_db_schema_version`) + `deletes`. The syncable content tables are listed
in `DICT_SYNCABLE_TABLES` (`$lib/db/server/dictionary-sync-helpers.ts`). Every
content table carries NOT NULL `created_by_user_id` / `updated_by_user_id`
(collaborative editing — see auto-stamping below).

**Sentence ordering** uses a fractional `sort_key TEXT` (LexoRank-style) +
`ends_paragraph` flag.

### Why split

- A 50,612-entry dictionary's data shouldn't ride the catalog around to every
  admin. Per-dict isolation keeps each user's offline working-set small.
- R2 snapshots make first-load fast even for the biggest dicts.
- Editor writes go server-direct (no inter-client conflict — single writer
  authority on the VPS re-checks role on every push).
- The catalog stays compact enough for the admin to fully mirror locally.

## Auto-parse driver contract (JSON columns)

**Rule:** `text({ mode: 'json' }).$type<T>()` in Drizzle IS the runtime JS
type on both client and server. JSON columns are always parsed objects in JS,
never hand-stringified.

- **Reads**: every path that returns rows from SQLite runs `parse_row(table, row)`.
  - **Server**: use `query_all` / `query_one` from `$lib/db/server/typed-query.ts`.
  - **Client**: the TableStore in `$lib/db/client/live/` and the DictTableStore
    in `dict-live-db.svelte.ts` handle this automatically.
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
  open. Mirrors only what the sync engine populates (server-only tables like
  `client_logs` are created empty client-side but stay empty).
- **Client (per-dict)**: the snapshot it pulls from R2 is already at a known
  schema version. The leader worker (`dict-instance.ts`) compares the snapshot's
  stamped `dict_db_schema_version` against the bundled migrations
  (`dict-migrations-bundle.ts`) and applies any newer ones locally.

### Writing a migration
1. Add `<YYYYMMDD><letter>_<name>.sql` (letter suffix orders within a day) in the right `*-migrations/` dir.
2. Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, idempotent `ALTER TABLE` where SQLite supports it (it doesn't ADD CONSTRAINT or DROP COLUMN well — plan accordingly).
3. Update the Drizzle schema (`shared.ts` / `dictionary.ts`) to match.
4. For dict-migrations: bump the latest version sentinel the boot sweep stamps
   on every dict catalog row (`dict_db_schema_version`).
5. Add a test under `lib/db/server/` if the change is invasive.

### CRITICAL: migration discipline for dict.db
Per-dict snapshots live in R2 with a stamped schema version, so an incompatible
mid-flight migration would strand editors holding the old snapshot. The
boot-sweep ensures every dict catalog row gets the new `dict_db_schema_version`
before the snapshot builder rebuilds — DO NOT skip the version bump when
introducing a new dict-migration. Background:
`.knowledge/migration/dict-sync-invariants.md` + `m4-write-sync.md`.

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
objects. Plain `db.prepare(...).get()` works fine for aggregates.

For mutations, `stringify_row(table, row)` before insert/update so JSON columns
get encoded once at the boundary:

```ts
import { stringify_row } from '$lib/db/schemas/json-columns'

const row = stringify_row(users, { id, email, name, providers: [...], ... })
db.prepare('INSERT INTO users (...) VALUES (...)').run(row.id, row.email, ...)
```

## Querying / modifying the production VPS DBs (ops)

Reading or editing the **live** DBs on the `living` VPS — user lookups, dictionary inspection,
schema/migration state, thread fixes, deletions. The DB is live: **always run a read-only query to
confirm what you're targeting before any destructive op.**

**Locations** (both DB classes; container path is what you use inside `docker exec`):

| | Host | Container (`DATA_DIR=/data`) |
|---|---|---|
| `shared.db` | `/opt/hosting/data/shared.db` | `/data/shared.db` |
| per-dict | `/opt/hosting/data/dictionaries/<id>.db` | `/data/dictionaries/<id>.db` |
| attachments | `/opt/hosting/data/files/<message_id>/<attachment_id>/<filename>` | — |

`sqlite3` is NOT on the VPS host — query through the app container. The VPS runs **blue/green** (since
2026-06-24): exec into the **primary `sveltekit_blue`** (`sveltekit_green` is the standby and shares
the same `/data` mount, so either works for read-only queries — there is **no** plain `sveltekit`
container). Escaping inside `docker exec` is brutal, so write the query to a local temp `.js` and pipe
it through stdin (open `{ readonly: true }` unless you intend to write):

```bash
cat > /tmp/q.js <<'EOF'
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
console.log(JSON.stringify(db.prepare('SELECT id, email, name, admin_level, created_at FROM users WHERE email = ?').all('someone@gmail.com'), null, 2))
EOF
ssh living 'docker exec -i sveltekit_blue node' < /tmp/q.js
```

Per-dict DBs use the same pattern with `/data/dictionaries/<id>.db` (e.g.
`SELECT COUNT(*) FROM entries`, `SELECT * FROM entries WHERE id = ?`). Compose any other lookup from
the schema (`shared.ts` / `dictionary.ts`); the catalog ↔ per-dict split is described at the top of
this skill.

### Safety rules

1. **Confirm before destructive ops** — read-only query first; echo back id, email/name, what gets
   changed, and the row count.
2. **Express deletes as tombstones**, not raw `DELETE`: `INSERT INTO deletes (table_name, id) VALUES
   (?, ?)` fires `process_delete_cascade` (trigger DELETEs + FK-cascades children) so peers + the
   snapshot builder drop the row on next sync too. Set `dirty = 1` + bump `updated_at` on any
   `shared.db` edit so admin clients pick it up.
3. **Never** raw `DELETE`/`UPDATE` without a `WHERE`, never `DROP TABLE` without per-command
   confirmation, never touch `users` unless explicitly told to delete an account.
4. **Per-dict writes propagate via the R2 snapshot, not sync** — a VPS edit won't show in editors'
   browsers until the next builder run (~30 min) or a manual rebuild
   (`bin/build-all-snapshots.ts --dict-id=<id>`). Say so when the lag applies.
5. **Schema changes** belong in a migration file (deploy → `hooks.server.ts` applies on boot), not
   ad-hoc SQL. If you must run one live, stop **both** app containers first (`docker stop
   sveltekit_blue sveltekit_green`) to avoid WAL corruption — under blue/green both have the DB open.
6. **Back up before destructive `shared.db` / high-value per-dict ops** — see `backup-vps-db.md` for
   the online-backup → R2 pattern; quick ad-hoc:
   `ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'`.

### Pulling a DB copy to local

```bash
ssh living 'sudo cp /opt/hosting/data/shared.db /tmp/shared.db && sudo chown $USER:$USER /tmp/shared.db'
scp living:/tmp/shared.db /tmp/living-shared.db   # WAL mode allows readers; per-dict: swap the path
```

For a hot-consistent copy under write load, use the online backup API (`backup-vps-db.md`).

### Related ops

- **Logs** (`client_logs` errors/sessions/telemetry): the **check-logs** skill.
- **Server/Caddy/Docker/deploy/env**: `.claude/commands/debug-vps.md`.
- **Backup → R2** before destructive changes: `.claude/commands/backup-vps-db.md`.

## Client-side reactive data (LiveDb / DictLiveDb)

Two reactive accessors with the **same core shape** (`.rows` / `.objects` /
`.id()` / `.find()` / `.query()`, `insert`/`upsert`/`update`/`delete`, and row
`_save`/`_reset`/`_delete`). They differ in which DB they wrap and in a handful
of methods/semantics — composite keys, `.merge()`, delete semantics, audit
auto-stamping — all spelled out under **"shared.db (`LiveDb`) differences"**
below. Both expose write methods.

| Accessor | Wraps | Mounted at | Routes | Writes? |
|---|---|---|---|---|
| **`LiveDb`** (`client/live/`) | admin shared.db mirror (wa-sqlite, IDB) | `page.data.db` | `/admin/*` | yes (admins) |
| **`DictLiveDb`** (`dict-client/dict-live-db.svelte.ts`) | per-dict dict.db (wa-sqlite, OPFS, leader dedicated worker) | `page.data.dict_db` | `[dictionaryId]/*` | yes (editors) |

The `[dictionaryId]/+layout.ts` owns the dict connection lifecycle: it opens
the dict via `open_dict()`, builds `create_dict_live_db(conn, { user_id })`,
caches `{ connection, dict_db }` on `globalThis.__ld_dict_connections[dict_id]`
(survives layout invalidation), and exposes `dict_db` on `page.data`.

```svelte
<script lang="ts">
  import { page } from '$app/state'
  const dict_db = $derived(page.data.dict_db)        // DictLiveDb | null
  const entry = $derived(dict_db?.entries.id(entry_id))
</script>

{#if entry}
  <input bind:value={entry.lexeme.default} onblur={() => entry._save()} />
{/if}
```

### Accessing & mutating data — the full walkthrough

The examples below use **`page.data.dict_db`** (the per-dict editing surface,
where almost all content work happens). The admin **`page.data.db`** shared.db
accessor has the same API with the differences noted in the callout at the end.
`dict_db` can be `null` (SSR / before the leader worker opens) — guard with
`dict_db?.…`.

```svelte
<script lang="ts">
  import { page } from '$app/state'
  const dict_db = $derived(page.data.dict_db) // DictLiveDb | null
</script>
```

> **CRITICAL: never spread or copy rows** (`[...rows]`, `{ ...row }`, `.map()`,
> `.filter()`, `.sort()`, `.reverse()`, `Array.from()`). That breaks reactivity
> AND strips `_save` / `_delete` / `_reset`. Use `.query({ where, order_by,
> limit, offset })` for filtering/sorting/paginating, and iterate the original
> rows directly.

#### Accessing data

**All rows as a reactive array:**
```svelte
<script lang="ts">
  const speakers = $derived(dict_db?.speakers.rows ?? [])
</script>

{#each speakers as speaker (speaker.id)}
  <div>{speaker.name}</div>
{/each}
```

> ✅ FIXED (2026-07-04): this pattern used to silently freeze when the consuming `$derived` was
> the FIRST reader (svelte excludes signals created during a reaction's run from its deps —
> `current_sources` — and the lazily-created store's `$state` fell into that trap). Store
> creation is now hoisted via `construct_outside_reaction`
> (`$lib/db/client/live/construct-outside-reaction.svelte.ts`) in both LiveDb and DictLiveDb,
> so bare `.rows` in a `$derived` is safe. If you build a NEW lazily-created reactive store,
> use the same helper — repro + mechanism: repo-root `reactivity-poc/` and
> `.issues/dict-table-accessor-rows-reactivity.md`.

**All rows keyed by id (O(1) lookup):**
```svelte
<script lang="ts">
  const senses = $derived(dict_db?.senses.objects ?? {})
</script>

{#if senses[some_sense_id]}
  <span>{senses[some_sense_id].definition?.en}</span>
{/if}
```

**A single row by id** (efficient single-row subscription — doesn't re-fire when
other rows change):
```svelte
<script lang="ts">
  const entry = $derived(dict_db?.entries.id(entry_id))
</script>

{#if entry}
  <input bind:value={entry.lexeme.default} onblur={() => entry._save()} />
{/if}
```

**Loading state:**
```svelte
{#if dict_db?.entries.loading}
  <p>Loading…</p>
{:else}
  {#each dict_db?.entries.rows ?? [] as entry (entry.id)}…{/each}
{/if}
```

#### Non-reactive single-row lookup

`find()` is an async, non-reactive read straight from the DB (don't `await` the
reactive `.id()` / `.objects` — those are sync stores):
```ts
const entry = await dict_db.entries.find(entry_id)
if (entry) console.log(entry.lexeme.default)
```

#### Creating rows

`insert()` auto-generates `id` (and, for syncable tables, stamps `dirty` /
`updated_at` / `created_by_user_id` / `updated_by_user_id`). Returns the
inserted rows:
```ts
await dict_db.speakers.insert({ name: 'Ada', birthplace: 'Lagos' })

// multiple at once:
await dict_db.dialects.insert([{ name: 'Coastal' }, { name: 'Highland' }])
```

#### Upserting rows

`upsert()` inserts or updates on primary-key conflict:
```ts
await dict_db.speakers.upsert({ id: existing_id, name: 'Ada Lovelace' })
```

#### Partial update by id

`update()` patches fields without loading the row first (use when you don't have
the live row in hand):
```ts
await dict_db.entries.update({ id: entry_id, phonetic: 'əˈda' })
```

#### Updating rows (mutate-then-save)

Rows are reactive `$state` — assign a property (UI updates optimistically), then
`_save()` to persist:
```svelte
<script lang="ts">
  const speaker = $derived(dict_db?.speakers.id(speaker_id))
</script>

{#if speaker}
  <input bind:value={speaker.name} onkeydown={(e) => e.key === 'Enter' && speaker._save()} />
  <button onclick={() => speaker._save()}>Save</button>
{/if}
```

#### Discarding changes

`_reset()` throws away unsaved mutations and reloads from the DB:
```svelte
<input bind:value={speaker.name} />
<button onclick={() => speaker._save()}>Save</button>
<button onclick={() => speaker._reset()}>Cancel</button>
```

#### Deleting rows

`_delete()` (row) / `.delete(id | id[])` (table) **hard-delete** via a tombstone:
they `INSERT INTO deletes (table_name, id)`, which fires the
`process_delete_cascade` trigger that `DELETE`s the row (FK `ON DELETE CASCADE`
sweeps its children). The row vanishes from `.rows` / `.objects` instantly, the
tombstone is the durable delete log + sync push queue, and on sync every peer +
the snapshot builder hard-delete it too (the server trigger truly `DELETE`s, so
the raw `.backup()` snapshot is taken from a DB where the row is already gone —
nothing to resurrect). There is **no `deleted` column** anymore. Multi-table
intent (entry→senses, sentence→junctions) is just the FK cascade; junction
link/unlink + multi-row creates still go through `operations.ts`:
```svelte
<button onclick={() => speaker._delete()}>Delete</button>
```
```ts
await dict_db.dialects.delete([id1, id2, id3])
```

#### Custom queries

`query()` returns its own accessor with `.rows` / `.loading` / `.snapshot()`:
```svelte
<script lang="ts">
  const recent = $derived(
    dict_db?.entries.query({ order_by: 'updated_at DESC', limit: 10 }).rows ?? []
  )
</script>
```

**With parameters:**
```ts
const for_speaker = $derived(
  dict_db?.audio.query({ where: 'speaker_id = ?', params: [speaker_id] }).rows ?? []
)
```

**Non-reactive snapshot** (one-time read, raw rows without `_save`/`_delete`/`_reset`):
```ts
const rows = await dict_db.entries.query({ order_by: 'updated_at DESC', limit: 10 }).snapshot()
```

#### Row methods summary

| Method | Description |
|--------|-------------|
| `_save()` | Persist the row's current mutations (auto-stamps `dirty`/`updated_at`, re-stamps the editor on syncable tables). |
| `_reset()` | Discard unsaved mutations, reload from the DB. |
| `_delete()` | Hard-delete this row (writes a `deletes` tombstone → trigger `DELETE`s it + FK-cascades children). |

#### Table accessor properties

| Property/Method | Description |
|-----------------|-------------|
| `.rows` | Reactive array of all rows (hard-delete: deleted rows are gone, not filtered) |
| `.objects` | Reactive object keyed by id for O(1) lookups |
| `.id(some_id)` | Single-row reactive subscription (efficient; doesn't re-fire on unrelated row changes) |
| `.find(some_id)` | Async, non-reactive single-row lookup straight from the DB |
| `.loading` | Boolean — true until the first read resolves |
| `.insert(data)` | Insert one or many; auto-generates `id`; returns inserted rows |
| `.upsert(data)` | Insert or update on primary-key conflict |
| `.update({ id, …fields })` | Partial update by id without loading the row first |
| `.delete(id \| id[])` | Hard-delete by id (writes a `deletes` tombstone → trigger `DELETE`s + FK-cascades) |
| `.query(options)` | Build a filtered/sorted/paginated query accessor |

> **Auto-stamping (syncable tables).** `insert`/`upsert`/`update`/`_save`
> automatically set `dirty = 1` and bump `updated_at`, and `insert` auto-generates
> `id`. On **dict.db** they also stamp `created_by_user_id` (insert/upsert) and
> re-stamp `updated_by_user_id` (every write) from the `DictLiveDb`'s `user_id`
> (which is why `DictInsertType` makes those auto-columns optional — callers pass
> only real content). Don't set these by hand. (`_delete`/`.delete()` instead
> write a `deletes` tombstone; `DictLiveDb` has no `.merge()` — that's shared.db only.)

#### Query accessor properties

| Property/Method | Description |
|-----------------|-------------|
| `.rows` | Reactive array of query result rows |
| `.loading` | Boolean — true while the query is still loading |
| `.snapshot()` | Async non-reactive one-time read (raw rows, no `_save`/`_delete`/`_reset`) |

#### shared.db (`LiveDb`) differences

`page.data.db` (admin shared.db, `/admin/*`) is the same API with these
exceptions:

- **Composite-key tables** — `deletes` (`table_name`,`id`), `db_metadata`
  (`key`), `email_aliases` (`email`). For these, `.id()` / `.find()` take the
  compound key as an **object** and `.update()` requires the key columns. dict.db
  has none of this — every table has a synthetic UUID `id`.
- **`.merge(rows)`** — last-write-wins bulk upsert (only writes a row when the
  incoming `updated_at` is newer; requires `updated_at` on every input row).
  Exists on `LiveDb` only.
- **`.delete()` is a hard delete + tombstone** — it `DELETE`s the row locally and
  writes a `deletes` row. Composite-key tables **throw** on delete (append-only).
  dict.db is **also** hard-delete-via-tombstone (same `deletes`-table +
  `process_delete_cascade` trigger model), but with FK `ON DELETE CASCADE` to sweep
  children; it has no composite-key tables.
- **No audit columns** — shared.db tables don't carry `created_by_user_id` /
  `updated_by_user_id`, so no editor stamping happens there.

### Auto-stamped audit columns (dict.db)

`DictLiveDb` is constructed with a `user_id` (the layout passes
`auth_user.user?.id`, refreshed each load via `dict_db.set_user_id(...)` so a
login/logout while a dict is open re-points it). For **syncable** tables, the
write paths auto-stamp:
- `_save()` / `update()` → `updated_by_user_id` (force-restamped to the current editor).
- `insert()` / `upsert()` → `created_by_user_id` + `updated_by_user_id` if absent.

So components mutate-then-save without hand-stamping who edited. **`operations.ts`
no longer injects the user id** — it stays only for genuinely multi-table
orchestration (entry+sense, sentence+junction, media+junction) and junction
link/unlink. (`shared.db`'s `LiveDb` has no such audit columns.)

### The per-dict read-model caveat (important context)

Per-dict content currently has **two representations**:
1. The reactive `DictLiveDb` rows (above) — the write authority + sync source.
2. A denormalized **`EntryData`** read-model (`entry.main`, `entry.senses[]`
   with nested glosses/media/dialects/tags) — assembled by `init_entries` from
   `read_dict_bundle`, held in a plain store (`entries-ui-store.ts`), kept fresh
   by `orama-watcher.ts`. This feeds the Orama search index and the
   list/gallery/table/print views + SEO.

**Scalar entry/sense field edits now go straight to the live `DictLiveDb` row**,
not through `dbOperations`:
- **Entry detail** (`EntryDisplay.svelte` / `Sense.svelte`) **renders** each scalar
  field off `dict_db.entries.id(entry.id)` / `dict_db.senses.id(sense.id)` and saves
  with a small `save_entry(patch)` / `save_sense(patch)` helper (`Object.assign` the
  patch, then `_save()`). No read-model fallback there — the route gates on data
  being loaded, so the live row is present.
- **Table inline-edit** (`entries/table/Cell.svelte`) keeps **displaying** from the
  read-model (#2) but **persists** via `dict_db.entries.update({ id, … })` /
  `dict_db.senses.update({ id, … })` (partial update by id — no per-cell
  subscription). Entry coordinates (`EntryMedia.svelte`) likewise.

The Orama watcher reflects every such `_save()`/`update()` back into the `EntryData`
read-model, which stays the index for search + list/gallery/table/print + SEO.
`dbOperations`/`operations.ts` is now **only** multi-table orchestration (entry+sense
create, sentence+junction, media+junction) and junction link/unlink — it no longer
has `update_entry`/`update_sense` or a `clean()` shim. Each such group is ONE atomic
**`dict_write`** RPC: the leader worker runs the matching orchestrator in
`dict-client/dict-writes.ts` inside `BEGIN/COMMIT` under the op-mutex (so a group can
never half-land or interleave with a sync apply-transaction). `.insert()`/`.upsert()`
also route through `dict_write` (`insert_rows`/`upsert_rows`) — the stamping lives
worker-side in `dict-writes.ts`. When adding/editing a per-dict
**scalar** field, use the live-row pattern; when adding a NEW multi-table write, add
an orchestrator to `dict-writes.ts` + a line to the `DictWrites` facade. Plan + rationale:
`.issues/livedb-scalar-field-migration.md` (and the foundation in
`.issues/livedb-adoption-and-db-skill.md`).

### Pitfall reminders

- **Don't spread or copy rows** (`[...rows]`, `{...row}`, `.map()`, `.filter()`,
  `.sort()`, `.reverse()`, `Array.from()`). These break reactivity AND strip
  `_save / _delete / _reset`. Use `.query({ where, order_by, limit, offset })`
  for filtering/sorting/paginating; iterate the original rows directly.
- **`.objects` / `.id()` are sync reactive stores, not promises** — don't
  `await` them. Use `.find()` for an async non-reactive lookup.
- **Updates need `_save()`.** Mutating a property updates the UI optimistically
  (reactive `$state`) but does NOT write to the DB until `_save()`.
- **`page.data.dict_db` can be `null`** (SSR, or before the leader worker opens).
  Guard with `dict_db?.…`.

## Sync engines (read this when touching sync code)

- **Admin shared.db sync**: `$lib/db/sync/engine.svelte.ts` (client) +
  `lib/db/server/sync-helpers.ts` (server). Sector-based; tracks watermarks in
  `db_metadata`. Dirty rows uploaded, server rows pulled by sector.
- **Per-dict sync**: `$lib/db/dict-client/dict-sync-engine.ts` is much simpler —
  snapshot-as-of-build + change-since-snapshot fetch on connect, and editors'
  dirty rows pushed through `/api/dictionary/[id]/changes` (the `/db` endpoint is
  the editor snapshot fetch, not the push). Runs inside the leader dedicated
  worker; its apply-transaction shares the instance op-mutex. The snapshot builder
  eventually reflects pushed rows in R2. Server helpers: `dictionary-sync-helpers.ts`.

**Sync-engine invariants (don't relearn):** clear `dirty` ONLY by pushed row id
(not blanket `WHERE dirty=1` — junctions silently never sync); drain local
`deletes` tombstones ONLY by pushed (table_name,id) — a blanket `DELETE FROM
deletes` drops a delete queued mid-round-trip; `db_metadata`
triggers use `ON CONFLICT DO UPDATE` (not `INSERT OR REPLACE`); `/changes`
fast-bail must not drop pushes when `cursor==watermark`; `ensure_initial_sync()`
before writes. **Natural-key dedup must converge the CLIENT too** (2026-07-09,
house's Wayne wedge): a server-side adopt-canonical resolution must ALSO
tombstone + echo the loser id (clients apply deletes before upserts and honor
deletes for ids they just pushed) and explicitly echo the canonical row —
otherwise the pushing client's local loser still owns the UNIQUE key, its apply
throws the same error, and it wedges into a retry-forever loop. Every
natural-key table needs a spec in the coverage-guarded convergence e2e suites
(`dict-sync-engine.convergence.test.ts` / `engine-convergence.svelte.test.ts`).
Both client engines carry a repeat-fatal circuit breaker (`RepeatFailureTracker`
in `sync-failure-classify.ts`): 3 identical consecutive non-transient failures
halt retrying + prompt a reload (`sync_halted_repeated_failure` in client_logs).
Full detail: `.knowledge/migration/dict-sync-invariants.md` +
`m4-write-sync.md`.

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
    live/                              LiveDb reactive store (page.data.db)
  dict-client/                         Per-dict (wa-sqlite, OPFS leader dedicated worker)
    worker/                            Generic harness (4 files verbatim from house)
      opfs-sah-vfs.js                  Single-owner OPFS sync-access-handle VFS (held SAH → ~1×)
      opfs-connection.ts               open_opfs_connection + raw OPFS file helpers (snapshot drop-in)
      leader-election.ts               navigator.locks leader election (one leader per dict)
      transport.ts                     BroadcastChannel RPC client/server (the swappable seam)
      instance.ts                      DbRequest/DbEvent/LeaderMeta contract; channel/lock keyed by dict_id
      leader-worker.ts                 Dedicated-worker entry; imports dict-instance
      db-client.ts                     Main-thread client: election + transport + spawn leader
    dict-instance.ts                   The per-dict DB instance (boot/promote, op-mutex, migrations, sync)
    dict-lifecycle.ts                  open_dict (per-dict DbClient cache, set_role re-assert on hand-off)
    worker-connection.ts               Main-thread DictConnection shim over the DbClient
    memory-connection.ts               MemoryVFS fallback (pre-iOS-17, no OPFS SAH)
    dict-live-db.svelte.ts             DictLiveDb reactive store (page.data.dict_db) + `writes` facade
    dict-writes.ts                     Worker-side atomic write orchestrators (`dict_write` op dispatch)
    operations.ts                      Thin main-thread wrappers over `dict_db.writes` (dbOperations)
    dict-sync-engine.ts                Snapshot + changes-since + push (plain class, op-mutex-wrapped)
    fetch-snapshot.ts                  R2/VPS snapshot fetch + normalize_snapshot_header (WAL→rollback)
    opfs-lru.ts                        LRU eviction for offline storage (held-SAH-guarded)
    dict-migrations-bundle.ts          Bundled migrations for client-side apply
  server/
    shared-db.ts                       better-sqlite3 shared DB singleton
    dictionary-db.ts                   Per-dict DB connection pool
    sync-helpers.ts                    process_sync admin sector engine
    dictionary-sync-helpers.ts         Per-dict push/changes helpers + DICT_SYNCABLE_TABLES
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
  migrate every dict on every boot. The migration script handles this.
- **OPFS first-write race** — first connect to a per-dict DB writes the
  snapshot. Only the ONE leader tab (elected via `navigator.locks`) owns the
  OPFS file + writes the snapshot; other tabs are followers that RPC the leader,
  so there's no cross-tab write race. Leader-tab close hands off to another tab.
- **Snapshots must be rollback-journal, not WAL** — the single-file OPFS SAH VFS
  returns `SQLITE_CANTOPEN` on a WAL-mode header (better-sqlite3 `.backup()`
  preserves it). The R2 cron + editor `/db` endpoint run `journal_mode = DELETE`;
  the client `normalize_snapshot_header` flips the header bytes as a safety net.
  See `.knowledge/migration/opfs-leader-worker-dict-db.md`.
- **`storage_path` is a path, not a URL** — media (audio/photos/videos) stores
  a storage path; resolve to the GCS / lh3 serving URL at render time (see
  `src/lib/helpers/media-url.ts` and `.knowledge/domain/media-serving-urls.md`),
  don't store URLs in the DB.
- **Drizzle migrations are NOT used** — only the raw SQL files. Don't run
  `drizzle-kit generate`; it would emit untracked migrations.
- **Inspect the deployed VPS db** — see **"Querying / modifying the production VPS DBs"** above. Live introspection UI at `/admin/schema`.

## Cross-references

- API-endpoint patterns (auth + tests): `.claude/skills/api-endpoint/SKILL.md`
- Per-dict write/sync deep-dive: `.knowledge/migration/m4-write-sync.md`
- Per-dict read layer (bundle → Orama → EntryData): `.knowledge/migration/m4-sqlite-read-layer.md`
- Sync invariants: `.knowledge/migration/dict-sync-invariants.md`
- Build/deploy + lockfile discipline: `.knowledge/migration/build-and-deploy-gotchas.md`
- Related-entries model: `.knowledge/domain/related-entries-model.md`
