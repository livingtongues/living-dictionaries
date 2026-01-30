# Living Dictionaries Architecture Overview

## Project Structure
This is a pnpm monorepo containing a dictionary-building platform built with SvelteKit for the main application and backend serverless functions. Supabase is used for database and authentication.

### Key Directories
- `/packages/site` - Main SvelteKit/Svelte 5 application
  - `/packages/site/src/routes` - SvelteKit routes
  - `/packages/site/src/routes/api` - Main app API routes (backend endpoints), import using `$api/...` alias
  - `/packages/site/src/lib` - Shared libraries and utilities (import using `$lib/...` alias)
    - `/lib/supabase` - Supabase client, operations, and authentication
    - `/lib/pglite` - PGlite database setup, schema, and migrations
    - `/lib/components` - Reusable Svelte components (modals, keyboards, UI elements, maps)
    - `/lib/i18n` - Internationalization system with locale files
    - `/lib/helpers` - Utility functions and transformers
    - `/lib/constants.ts` - Application-wide constants (use these instead of magic strings)
    - `/lib/search` - Orama client-side full-text search integration
    - `/lib/export` - Data export functionality
    - `/lib/mocks` - Test mocks and seed data
  - `/packages/site/src/docs` - Documentation (markdown files served via Kitbook) - out of date
- `/packages/types` - Shared TypeScript types and interfaces
  - Database types (Supabase generated + custom)
  - Entry, dictionary, and user interfaces
  - GeoJSON, photo, video types
- `/packages/scripts` - Utility scripts for data operations
  - Database migrations and imports
  - Type generation and merging
  - Spreadsheet helpers
  - Locale updates
- `/supabase` - Supabase configuration

### Technology Stack
- **Frontend**: SvelteKit with Svelte 5 runes syntax
- **Backend**: SvelteKit server endpoints (+server.ts files)
- **Styling**: UnoCSS (Tailwind CSS syntax) with Iconify icons used like `<span class="i-iconamoon-arrow-left-1"></span>`
- **Database & Auth**:
  - Supabase (Postgres)
  - Authentication via Supabase Auth
- **Testing**:
  - Vitest for unit and integration tests

## Coding Guidelines

### How to Edit Svelte Components
This includes all files ending in `.svelte` including `+page.svelte` and `+layout.svelte`

The user runs the dev server themselves at http://localhost:3041 - To check for build errors or server output after making changes, tail the log file:

```bash
tail -100 app/.dev-server.log
```

**Important:**
- Do NOT start a dev server yourself - the user already has one running
- Before verifying changes work, check the log for errors

### Code Style
- Use hard-coded constants from `lib/constants.ts` instead of arbitrary string values or magic numbers
- Follow existing patterns in the codebase for consistency

### SQL & Database
- Use ALLCAPS for SQL keywords (SELECT, FROM, WHERE, etc.)
- Supabase tends to generate lowercase - fix this when you see it
- Use typed Supabase client methods (from `@living-dictionaries/types`)

### Internationalization (i18n)
- Place new English strings in `packages/site/src/lib/i18n/locales/en.json`
- Do NOT add translations for other languages - human translators handle these
- Access translations in Svelte components:
  ```svelte
  <script>
    import { page } from '$app/state'
  </script>
  {page.data.t.section.key}
  ```
- Organize translations by logical sections
- Use descriptive keys that indicate purpose

## Useful Commands (from root)
- `pnpm test` - Run all unit tests with Vitest
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm check` - Run svelte-check for type errors
- `pnpm generate-types` - Generate TypeScript types from Supabase schema

## UI Database Interaction using Live PGlite

The `page.data.db` object provides a reactive, live-query interface to PGlite tables. Data automatically updates when the database changes, and rows can be mutated directly and saved. Whenever interacting with PGlite in the app, use this interface.

### Accessing Data

**Get all rows as an array:**
```svelte
{#each page.data.db.texts.rows as text (text.id)}
  <div>{text.title}</div>
{/each}
```

**Get all rows as an object keyed by id (fast lookup):**
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
{#if page.data.db.texts.id[text_id]}
  <div>{page.data.db.texts.id[text_id].title}</div>
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

### Updating Rows

Rows are reactive Svelte 5 `$state` objects. Mutate properties directly (the UI will update reactively), then call `_save()` to persist changes to the database:

```svelte
<script lang="ts">
  async function mark_as_read(text: { read_at: Date | null, _save: () => Promise<void> }) {
    text.read_at = new Date()
    await text._save()
  }
</script>

{#each page.data.db.texts.rows as text (text.id)}
  <div>
    <span>{text.title}</span>
    <button type="button" onclick={() => mark_as_read(text)}>Mark Read</button>
  </div>
{/each}
```

**Inline editing with two-way binding:**
```svelte
{#each page.data.db.texts.rows as text (text.id)}
  <input
    type="text"
    bind:value={text.title.en}
    onkeydown={e => e.key === 'Enter' && text._save()} />
  <button type="button" onclick={text._save}>Save</button>
{/each}
```

### Discarding Changes

Use `_reset()` to discard unsaved mutations and reload from the database:

```svelte
<input type="text" bind:value={text.title.en} />
<button type="button" onclick={text._save}>Save</button>
<button type="button" onclick={text._reset}>Cancel</button>
```

### Deleting Rows

Call `_delete()` on a row to remove it:

```svelte
<button type="button" onclick={text._delete}>Delete</button>
<!-- or with a wrapper function -->
<button type="button" onclick={() => text._delete()}>Delete</button>
```

**Delete multiple rows at once:**
```ts
await page.data.db.texts.delete_all([id1, id2, id3])
```

### Custom Queries

Use `query()` for filtered/sorted/paginated data:

```svelte
<script lang="ts">
  const recently_read_texts = $derived(
    page.data.db.texts.query({
      where: 'read_at IS NOT NULL',
      order_by: 'read_at DESC',
      limit: 10,
    }),
  )
</script>

{#each recently_read_texts.rows as text (text.id)}
  <div>{text.title}</div>
{/each}
```

**With parameters:**
```svelte
<script lang="ts">
  const { language } = $props()

  const chapters = $derived(
    page.data.db.text_chapters.query({
      where: '"language" = $1',
      params: [language],
      order_by: 'number ASC',
    }),
  )
</script>
```

### Row Methods Summary

Each row (from `page.data.db.<table>.rows` for example) has these methods attached:

| Method | Description |
|--------|-------------|
| `_save()` | Persist current mutations to the database |
| `_delete()` | Delete this row from the database |
| `_reset()` | Discard mutations and reload from database |

### Table Accessor Properties

Each `page.data.db.<table>` has these available:

| Property/Method | Description |
|-----------------|-------------|
| `.rows` | Reactive array of all rows |
| `.objects` | Reactive object keyed by id for fast lookups |
| `.id[some_id]` | Get a single row by id (subscribe just to single row instead of entire table) |
| `.loading` | Boolean indicating if initial data is still loading |
| `.insert(data)` | Insert one or more new rows |
| `.delete_all(ids)` | Delete multiple rows by their ids |
| `.query(options)` | Create a filtered/sorted query accessor that has .rows and .loading properties |
