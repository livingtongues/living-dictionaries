---
name: database
description: Database guidelines for SQLite (local-first with per-user server sync) and shared SQLite. Covers schema, migrations, queries, live reactive UI data.
---

## When to use me

When working with databases: SQLite schema/queries, shared-db changes, live reactive data in UI.

## Database Guidelines

- Use ALLCAPS for SQL keywords

### Folder layout (all under `$lib/db/`)

```
$lib/db/
  types.ts                           JSON payload types shared by schemas (MultiString, VideoLine, …)
  schemas/
    user.ts                          Drizzle schema: user-owned syncable tables (re-exports video_datas + video_channels from shared.ts)
    user.types.ts                    Types derived from user.ts
    user-migrations/                 Initial SQL for client DBs + per-user server DBs
    shared.ts                        Drizzle schema: server-only shared.db tables (users, email_codes, subscriptions, api_usage, video_datas, video_channels)
    shared.types.ts                  Types derived from shared.ts
    shared-server-migrations/        Initial SQL for the server shared.db only
    json-columns.ts                  JSON_COLUMNS map + parse_row / stringify_row helpers — auto-parse driver core
  client/
    connection.ts                    wa-sqlite wrapper (client query interface)
    db.ts                            Entry point; runs user-migrations
    import-words.ts
    live/                            LiveDb reactive Svelte 5 store + TableStore + TableChangeNotifier
  server/
    shared-db.ts                     better-sqlite3 shared DB connection
    user-db.ts                       Per-user better-sqlite3 DB connections
    sync-helpers.ts                  process_sync — accepts/returns parsed wire rows
    typed-query.ts                   query_all / query_one helpers that apply parse_row
    run-sql-migrations.ts
  sync/
    types.ts                         SyncRequest / SyncResponse / SyncRow<K>
    engine.svelte.ts                 Client sync engine
    history.svelte.ts
```

### Auto-parse driver contract

**Rule:** `text({ mode: 'json' }).$type<T>()` in Drizzle IS the runtime JS type on both client and server. JSON columns are always parsed objects in JS, never hand-stringified strings.

- **Reads**: every path that returns rows from SQLite runs `parse_row(table, row)`. On the server use `query_all` / `query_one` from `$lib/db/server/typed-query.ts`. On the client the TableStore in `$lib/db/client/live/table-store.svelte.ts` handles it.
- **Writes**: every path that inserts/updates calls `stringify_row(table, { ...row })` once at the top. Do NOT pre-stringify JSON columns yourself — `stringify_row` encodes everything (including plain strings) because a JS string `"hello"` must be stored as `"hello"` (with quotes) to be valid JSON storage.
- **Escape hatch**: raw `db.prepare(...)` is fine for aggregates / PRAGMA / migrations. Use `query_all` / `query_one` for anything that returns table rows.

### SQLite (Local-first)

- Use SQLite for all person-specific data (sync engine automatically handles syncing to per-user SQLite on server)
- Raw SQL queries via `SqliteConnection` interface
- Accessed via `$lib/db/client/db.ts`
- Schema: `$lib/db/schemas/user.ts`
- SvelteKit web app: wa-sqlite with IDBBatchAtomicVFS. (RN app will use a native SQLite driver — TBD.)

### Shared SQLite (Server)

- `$lib/db/server/shared-db.ts` — better-sqlite3 database at `/data/shared.db` on VPS
- Tables: `users`, `email_codes`, `video_datas`, `video_channels`, `subscriptions`, `api_usage`
- Migrations in `$lib/db/schemas/shared-server-migrations/`
- Used by server endpoints only (not accessible from client)
- Server user DBs run `user-migrations/` which creates `video_datas` + `video_channels` tables too (empty on the server — intentional trade-off because SQLite cannot `ALTER TABLE ADD CONSTRAINT` for the `videos.video_data_id` FK)

## UI Database Interaction using LiveDb

The `page.data.db` object provides a reactive, live-query interface to SQLite tables. Data automatically updates when the database changes, and rows can be mutated directly and saved. Whenever interacting with SQLite in the app, use this interface.

**CRITICAL: Never spread or copy rows from `page.data.db` (e.g. `[...rows]`, `{...row}`, `.map()`, `.filter()`, `.sort()`, `.reverse()`, `Array.from()`). This breaks reactivity and the `_save()`, `_delete()`, and `_reset()` methods on rows. Instead, use `.query()` with `order_by`, `where`, and `limit` options for filtering/sorting, and always iterate over the original rows/query results directly.**

### Accessing Data

**Get all rows as an array:**
```svelte
<script lang="ts">
  const texts = $derived(page.data.db.texts.rows)
</script>

{#each texts as text (text.id)}
  <div>{text.title}</div>
{/each}
```

**Get all rows as an object keyed by id (O(1) lookup):**
```svelte
<script lang="ts">
  const texts = $derived(page.data.db.texts.objects)
</script>

{#if texts[some_text_id]}
  <span>{texts[some_text_id].title}</span>
{/if}
```

**Get a single row by id:**
```svelte
{#if page.data.db.texts.id(text_id)}
  <div>{page.data.db.texts.id(text_id).title}</div>
{/if}
```

**Check loading state:**
```svelte
{#if page.data.db.texts.loading}
  <p>Loading...</p>
{:else}
  {#each page.data.db.texts.rows as text (text.id)}
    ...
  {/each}
{/if}
```

### Non-reactive Single Row Lookup

Use `find()` for an async, non-reactive lookup (hits the DB directly):

```ts
const text = await page.data.db.texts.find(text_id)
if (text) console.log(text.title)
```

### Creating New Rows

Use the `insert()` method on the table accessor:

```ts
await page.data.db.texts.insert({ 
  title: { en: title.trim() },
  description: description ? { en: description } : null 
})
```

You can also insert multiple rows at once:
```ts
await page.data.db.texts.insert([
  { title: { en: 'First' } },
  { title: { en: 'Second' } }
])
```

### Upserting Rows

Use `upsert()` to insert or update on conflict (based on primary key):

```ts
await page.data.db.texts.upsert({ 
  id: existing_id,
  title: { en: 'Updated or New' }
})
```

### Partial Update by ID

Use `update()` for a partial update without needing to load the row first:

```ts
await page.data.db.texts.update({ id: text_id, read_at: new Date() })
```

### Updating Rows

Rows are reactive Svelte 5 `$state` objects. Mutate properties directly (the UI will update reactively), then call `_save()` to persist changes to the database:

```svelte
<script lang="ts">
  async function mark_as_read(text: { read_at: Date | null; _save: () => Promise<void> }) {
    text.read_at = new Date()
    await text._save()
  }
</script>

{#each page.data.db.texts.rows as text (text.id)}
  <div>
    <span>{text.title}</span>
    <button onclick={() => mark_as_read(text)}>Mark Read</button>
  </div>
{/each}
```

**Inline editing with two-way binding:**
```svelte
{#each page.data.db.texts.rows as text (text.id)}
  <input
    type="text"
    bind:value={text.title.en}
    onkeydown={(e) => e.key === 'Enter' && text._save()}
  />
  <button onclick={text._save}>Save</button>
{/each}
```

### Discarding Changes

Use `_reset()` to discard unsaved mutations and reload from the database:

```svelte
<input type="text" bind:value={text.title.en} />
<button onclick={text._save}>Save</button>
<button onclick={text._reset}>Cancel</button>
```

### Deleting Rows

Call `_delete()` on a row to remove it:

```svelte
<button onclick={text._delete}>Delete</button>
<!-- or with a wrapper function -->
<button onclick={() => text._delete()}>Delete</button>
```

**Delete multiple rows at once:**
```ts
await page.data.db.texts.delete([id1, id2, id3])
```

### Custom Queries

Use `query()` for filtered/sorted/paginated data:

```svelte
<script lang="ts">
  const recent_texts = $derived(
    page.data.db.texts.query({
      where: 'read_at IS NOT NULL',
      order_by: 'read_at DESC',
      limit: 10
    }).rows
  )
</script>

{#each recent_texts as text (text.id)}
  <div>{text.title}</div>
{/each}
```

**With parameters:**
```svelte
<script lang="ts">
  const { language } = $props()
  
  const chapters = $derived(
    page.data.db.text_chapters.query({
      where: '"language" = ?',
      params: [language],
      order_by: 'number ASC'
    }).rows
  )
</script>
```

**With offset for pagination:**
```ts
const page_2 = $derived(
  page.data.db.texts.query({
    order_by: 'created_at DESC',
    limit: 10,
    offset: 10
  }).rows
)
```

**Non-reactive snapshot (for one-time reads):**
```ts
const rows = await page.data.db.texts.query({
  where: 'read_at IS NOT NULL',
  order_by: 'read_at DESC',
  limit: 10
}).snapshot()
```

**Check query loading state:**
```svelte
<script lang="ts">
  const query = $derived(page.data.db.texts.query({ where: 'read_at IS NOT NULL' }))
</script>

{#if query.loading}
  <p>Loading...</p>
{:else}
  {#each query.rows as text (text.id)}
    ...
  {/each}
{/if}
```

### Row Methods Summary

Each row from `page.data.db` has these methods attached:

| Method | Description |
|--------|-------------|
| `_save()` | Persist current mutations to the database |
| `_delete()` | Delete this row from the database |
| `_reset()` | Discard mutations and reload from database |

### Table Accessor Properties

| Property/Method | Description |
|-----------------|-------------|
| `.rows` | Reactive array of all rows |
| `.objects` | Reactive object keyed by id for O(1) lookups |
| `.id(some_id)` | Get a single row by id (creates efficient single-row subscription, reactive) |
| `.find(some_id)` | Async non-reactive lookup of a single row by id directly from DB |
| `.loading` | Boolean indicating if initial data is still loading |
| `.insert(data)` | Insert one or more new rows, returns inserted rows |
| `.upsert(data)` | Insert or update on primary key conflict, returns rows |
| `.update(set)` | Partial update a row by id (set must include `id` plus fields to update) |
| `.delete(ids)` | Delete one or more rows by id (accepts string or string[]) |
| `.query(options)` | Create a filtered/sorted/paginated query accessor |

### Query Accessor Properties

| Property/Method | Description |
|-----------------|-------------|
| `.rows` | Reactive array of query result rows |
| `.loading` | Boolean indicating if query data is still loading |
| `.snapshot()` | Async non-reactive one-time read of query results (returns raw rows without `_save`/`_delete`/`_reset`) |

### Per-user SQLite (Server Sync)

- `$lib/db/server/user-db.ts` — manages per-user `.db` files at `/data/users/{user_id}.db` (better-sqlite3)
- Each user's db runs `user-migrations/` (same as client) — `video_datas`/`video_channels` tables exist but stay empty on the server
- `$lib/db/server/sync-helpers.ts` — `process_sync` drives sector-based sync; the wire protocol carries parsed objects (no string-nested JSON)
- See sync engine docs in `.knowledge/architecture/sqlite-sync-engine.md` for full details
