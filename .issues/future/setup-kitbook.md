# Set up Kitbook for component screenshots and development

## Goal

Set up Kitbook in living-dictionaries matching tutor's setup so we can use the Kitshot MCP tool for component screenshots. The Kitshot MCP is already pointed at this repo (`/home/jacob/code/living-dictionaries`) but kitbook isn't installed or configured yet.

## Current State

- `kitbook.config.ts` exists but is outdated (uses old API: `viewports`, `languages`, `addLanguageToUrl`, `viewer`, `githubURL`)
- Kitbook vite plugin is **commented out** in `vite.config.ts`
- Kitbook is **not in package.json dependencies** (only a `local-kitbook` link script exists)
- No `src/routes/kitbook/` directory exists (only `.svelte-kit/types` stubs)
- No `.stories.ts` files exist in the project

## Steps

### 1. Install kitbook dependency
- Add `kitbook` to `packages/old-site/package.json` devDependencies using the same pkg.pr.new URL as tutor: `https://pkg.pr.new/jacob-8/kitbook-llm/kitbook@1fed7d5`
- Run `pnpm install`

### 2. Update `kitbook.config.ts`
- Update to match tutor's new API shape (`defineConfig` from `kitbook/defineConfig`)
- Use new property names: `page_viewports`, `component_viewports`, `dark_mode`, `flavor_names`
- Remove old properties: `viewports`, `languages`, `addLanguageToUrl`, `viewer`, `githubURL`
- Set port to `3041` (matching living-dictionaries dev server)
- Decide on viewports - suggest mobile (375x667) and desktop (1024x768) for page, medium (500x300) for components

### 3. Uncomment kitbook vite plugin in `vite.config.ts`
- Uncomment `import { kitbook } from 'kitbook/vite'` (note: tutor uses `kitbook/vite` not `kitbook/plugins/vite` - the import path in the commented code is old)
- Uncomment `import kitbook_config from './kitbook.config'`
- Uncomment `kitbook(kitbook_config)` in plugins array
- May need to update `optimizeDeps` if kitbook has deps that need inclusion

### 4. Create `src/routes/kitbook/` directory structure

Following tutor's pattern exactly:

#### `src/routes/kitbook/+layout.js`
- Import `kitbook_layout_load` from `kitbook`
- Import `stories_store` from `kitbook/stories-store`
- Set up component/story globs
- Set up HMR for stories
- Export `load` function with `kitbook_layout_load()`
- Provide `page_data` mock matching root layout data shape (locale, t, user, admin, supabase, etc.)
- Provide `contexts` if needed

**page_data shape needed** (from `+layout.ts`):
```ts
{
  locale: string,
  t: TranslateFunction,
  supabase: SupabaseClient, // may need mock
  user: store,              // may need mock
  my_dictionaries: store,   // may need mock
  authResponse: object,     // may need mock
  admin: store,             // may need mock
  preferred_table_columns: store, // may need mock
  mode: string,
  user_latitude: number,
  user_longitude: number,
  // from +layout.server.ts:
  db: LivePgLite,           // may need mock like tutor's mock-db
}
```

#### `src/routes/kitbook/+layout.svelte`
```svelte
<script>
  import { KitbookLayout } from 'kitbook'
  let { data, children } = $props()
</script>

<KitbookLayout {data}>
  {@render children()}
</KitbookLayout>
```

#### `src/routes/kitbook/[...file]/+page.js`
```js
export { component_page_load as load } from 'kitbook'
```

#### `src/routes/kitbook/[...file]/+page.svelte`
```svelte
<script>
  import { ComponentPage } from 'kitbook'
  let { data } = $props()
</script>
<ComponentPage {data} />
```

#### `src/routes/kitbook/sandbox/[...file]/+page.svelte`
```svelte
<script>
  import { SandboxPage } from 'kitbook'
  let { data } = $props()
</script>
<SandboxPage {data} />
```

### 5. Create mock data for Kitbook

#### `src/routes/kitbook/mocks/mock-db.svelte.ts`
- Copy tutor's `create_mock_db` proxy that simulates LivePgLite table accessor interface
- This provides `.rows`, `.objects`, `.loading`, `.id()`, `.find()`, `.insert()`, `.upsert()`, `.update()`, `.delete()`, `.query()`

#### Additional mocks as needed
- Mock translator function (can use real `getTranslator('en')`)
- Mock user store (writable store with null or mock user)
- Mock supabase client (minimal stub)
- Mock admin store

### 6. Verify setup
- Dev server should still work on port 3041
- Navigate to `localhost:3041/kitbook` to see Kitbook UI
- Test Kitshot MCP tool with `npx kitbook list` from `packages/old-site`
- Take a test screenshot of any existing component

## Questions to Resolve
- Do we want flavors (like tutor's world/china)? Probably not initially.
- What viewports make sense? Mobile + desktop seems right.
- Do we need to mock the `db` (PGlite) for kitbook or can we skip it initially? Probably need it since many components use `page.data.db`.
- The `+layout.svelte` imports `./global.css` - kitbook pages will need those styles too. The kitbook layout might need to import the global CSS or it may be handled automatically since it's in the root layout.

## Notes
- The Kitshot MCP tool is already configured pointing at `/home/jacob/code/living-dictionaries` and port 3041
- Kitbook's `kitbook_layout_load` provides mock page data to all kitbook pages so components can access `page.data.t`, `page.data.db`, etc.
- UnoCSS is used for styling - kitbook pages should get UnoCSS processing since it goes through the vite plugin
