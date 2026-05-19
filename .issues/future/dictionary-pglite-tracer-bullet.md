# pglite-switch - standalone tracer bullet for per-dictionary PGlite

## Goal

Build a standalone SvelteKit app at `packages/pglite-switch` that proves per-dictionary PGlite databases work. The home page lists all dictionaries from local Supabase. Clicking one opens a page that spins up a dictionary-specific PGlite instance, syncs entries down, and displays them reactively. Users can bop between dictionaries to verify that separate PGlite instances coexist and switch quickly.

## Architecture

```
packages/pglite-switch/
  package.json
  svelte.config.js
  vite.config.ts
  tsconfig.json
  src/
    app.html
    lib/
      supabase.ts              ← minimal Supabase client (uses env vars)
      pglite/
        schema.ts              ← Drizzle schema: entries, migrations, db_metadata, deletes
        migrations/
          0001_initial.sql     ← CREATE TABLEs + process_delete trigger
        db.ts                  ← factory: get_dictionary_db(dict_id) with Map cache
        live/                  ← copy + adapt from site's lib/pglite/live/
          live-pglite.svelte.ts
          table-store.svelte.ts
          types.ts
        sync.ts                ← download-only sync for entries
    routes/
      +layout.ts               ← init Supabase client
      +layout.svelte            ← minimal shell
      +page.svelte              ← list all dictionaries (links)
      +page.ts                  ← load dictionaries from Supabase
      [dictionary_id]/
        +page.ts               ← get_dictionary_db(), run sync, return db
        +page.svelte           ← show entries from PGlite, sync status
```

## Supabase `entries` Table (from generated types)

The Supabase `entries` table has these columns:
- `id` text PK
- `dictionary_id` text FK — **omit from local PGlite schema**
- `lexeme` jsonb (e.g. `{"es": "gato"}`)
- `phonetic` text nullable
- `interlinearization` text nullable
- `morphology` text nullable
- `notes` jsonb nullable
- `sources` text[] nullable
- `scientific_names` text[] nullable
- `coordinates` json nullable
- `elicitation_id` text nullable
- `unsupported_fields` jsonb nullable
- `created_at` timestamptz
- `created_by` uuid
- `updated_at` timestamptz
- `updated_by` uuid
- `deleted` text nullable (soft delete — we handle via deletes table instead)

## Implementation Plan

### 1. Scaffold the SvelteKit app

- `package.json` with deps: `@sveltejs/kit`, `svelte`, `@electric-sql/pglite`, `drizzle-orm`, `@supabase/supabase-js`, `@living-dictionaries/types`, `vite`
- `svelte.config.js` — adapter-auto (or adapter-static, doesn't matter for local dev)
- `vite.config.ts` — sveltekit plugin, port 3042, exclude `@electric-sql/pglite` from optimizeDeps
- `app.html` — minimal HTML shell
- Use the same `.env.development` approach: the app reads `PUBLIC_SUPABASE_API_URL` and `PUBLIC_SUPABASE_ANON_KEY` from the main site's env or its own copy (we just set these env vars, user handles the actual values)

### 2. Supabase client (`src/lib/supabase.ts`)

Minimal — just create a typed Supabase client:
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import { PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
export const supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)
```
No auth needed — local Supabase with anon key gives us read access to dictionaries and entries.

### 3. PGlite dictionary schema (`src/lib/pglite/schema.ts`)

Drizzle schema with 4 tables:
- `migrations` — id (uuid PK), name (text), run_on (timestamptz)
- `db_metadata` — key (text PK), value (text)
- `entries` — all columns from Supabase **except** `dictionary_id` and `deleted`. Add `local_saved_at` for sync tracking.
- `deletes` — table_name (text), id (text), composite PK

### 4. Migration SQL (`src/lib/pglite/migrations/0001_initial.sql`)

CREATE TABLEs for migrations, db_metadata, entries, deletes. Include `set_local_saved_at` trigger on entries. Include `process_delete` trigger that handles entries table. Follow the same patterns as the admin migration.

### 5. Dictionary DB factory (`src/lib/pglite/db.ts`)

```ts
const dictionary_dbs = new Map<string, DbInstance>()

export async function get_dictionary_db(dictionary_id: string) {
  if (dictionary_dbs.has(dictionary_id))
    return dictionary_dbs.get(dictionary_id)
  
  const pg = await PGlite.create({
    dataDir: `idb://dict-${dictionary_id}`,
    relaxedDurability: true,
    extensions: { live },
  })
  await pg.waitReady
  // run migrations (same pattern as admin db.ts)
  // create drizzle instance
  // create live_db via create_live_pglite(pg, { ... })
  const result = { pg, db, live_db, was_resumed }
  dictionary_dbs.set(dictionary_id, result)
  return result
}
```

### 6. LivePgLite adapted for dictionary schema (`src/lib/pglite/live/`)

Copy the three files from `packages/old-site/src/lib/pglite/live/` and adapt:
- **`types.ts`** — import from the new local `../schema` instead of site's schema. Same type derivation approach works since it reads table names from the schema export.
- **`live-pglite.svelte.ts`** — update `TABLE_PRIMARY_KEYS` to dictionary tables: `{ entries: ['id'], migrations: ['id'], db_metadata: ['key'], deletes: ['table_name', 'id'] }`. Update `READ_ONLY_TABLES` to `['migrations', 'db_metadata', 'deletes']`. For the tracer bullet, entries is read-only too but we can leave it editable in the LivePgLite config for future use.
- **`table-store.svelte.ts`** — copy as-is, no changes needed. It's generic.

### 7. Download-only sync (`src/lib/pglite/sync.ts`)

Minimal sync class/function:

```ts
export async function sync_entries({ pg, supabase, dictionary_id }) {
  // 1. Read synced_up_to from db_metadata (null = first sync)
  // 2. Fetch entries from Supabase:
  //    SELECT * FROM entries WHERE dictionary_id = $1 
  //      AND updated_at > synced_up_to ORDER BY updated_at LIMIT 1000
  // 3. For each batch:
  //    - Filter out deleted entries (deleted IS NOT NULL) → insert into local deletes table
  //    - Strip dictionary_id and deleted columns from remaining entries
  //    - UPSERT into local entries table
  // 4. Update synced_up_to in db_metadata
  // 5. Repeat until batch < 1000 (all caught up)
  // Return { entries_downloaded, deletes_processed }
}
```

Key detail: Supabase query filters by `dictionary_id` on the server side, but we strip that column before inserting locally since the whole PGlite DB belongs to one dictionary.

### 8. Routes

**`+layout.ts`** — Create Supabase client, pass to children:
```ts
const supabase = createClient(...)
return { supabase }
```

**`+page.ts`** (home) — Load all dictionaries from Supabase:
```ts
const { data } = await supabase.from('dictionaries').select('id, name, entry_count').order('name')
return { dictionaries: data }
```

**`+page.svelte`** (home) — Simple list of dictionary links:
```svelte
{#each dictionaries as dict}
  <a href="/{dict.id}">{dict.name} ({dict.entry_count} entries)</a>
{/each}
```

**`[dictionary_id]/+page.ts`** — The key route. In browser:
1. Call `get_dictionary_db(dictionary_id)` 
2. Kick off `sync_entries()` (don't await — let it sync in background)
3. Return `{ db: live_db, sync_status }` so the page can reactively display entries as they arrive

**`[dictionary_id]/+page.svelte`** — Display:
- Dictionary name at top
- Sync status (syncing/done, count downloaded)
- Link back to home
- List of entries showing lexeme values (first 50 or so)
- Entry count from PGlite (`db.entries.rows.length`)

## What This Proves

1. **Per-dictionary PGlite instances work** — each dictionary gets its own IndexedDB, its own schema, its own data
2. **Fast switching** — navigating between dictionaries reuses cached instances from the Map, or reopens from IndexedDB if page was refreshed
3. **Sync works** — entries download from Supabase into the local DB incrementally
4. **LivePgLite reactivity works** — entries appear on screen as sync progresses
5. **Persistence** — refresh the page, data is still there, sync picks up from where it left off

## Dependencies

- Local Supabase running (`pnpx supabase start`)
- Seed data with some dictionaries and entries (the main site's `reset-db` script should handle this)
- `@living-dictionaries/types` package for Supabase Database type

## Out of Scope

- Authentication (anon access to local Supabase is fine)
- Editing/uploading entries back to Supabase
- Senses, audio, photos, videos, sentences
- Orama search integration
- UnoCSS / styling (bare minimum inline styles)
- LRU eviction of dictionary instances
- Production deployment
