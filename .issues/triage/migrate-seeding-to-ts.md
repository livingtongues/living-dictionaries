---
title: Auto-seed PGlite with 1000 users and 1000 dictionaries on first init
type: feature
priority: 2
assignee: jacob
---

## Goal

When `pnpm dev` is run and a user navigates to the admin route, the PGlite database should be automatically seeded with realistic data (1000 users, 1000 dictionaries) on first initialization. Move away from `supabase/seed.sql` for this purpose and use JS/TS programmatically.

## Current State

### Existing seed infrastructure (`lib/mocks/seed/`)
- `tables.ts` - Hardcoded seed data objects (2 users, 1 dictionary, 2 entries)
- `to-sql-string.ts` - Converts JS objects to SQL INSERT strings (used to generate seed.sql)
- `postgres.ts` - Direct PG pool connection to local Supabase postgres
- `write-seed-and-reset-db.ts` - Either writes `supabase/seed.sql` or resets Supabase DB directly
- `write-seed-and-reset-db-script.ts` - Script entry point for above

### DB test patterns (`src/db-tests/`)
- `clients.ts` has `incremental_consistent_uuid(index)` for generating deterministic UUIDs - useful pattern to reuse
- Tests use `admin_supabase.auth.admin.createUser()` and Supabase client `.from().insert()` to seed programmatically
- All tests in `entries-data.test.ts` are commented out (old Svelte store patterns)

### PGlite initialization (`lib/pglite/db.ts`)
- `create_PG_lite()` creates the PGlite instance, runs SQL migrations, and tracks whether this is a new or resumed DB via `is_new_db` flag
- Currently does NO seeding after init
- Returns `{ db, pg, was_resumed, live_db }`

### Admin route (`routes/admin/+layout.ts`)
- Calls `get_PG_lite()` to get the singleton PGlite instance
- Then starts sync with Supabase
- This is where seeding would be triggered (after init, before sync, only on new DB)

### PGlite schema (`lib/pglite/schema.ts`)
Tables available to seed: `users`, `user_data`, `dictionaries`, `dictionary_roles`, `invites`, `deletes`, `db_metadata`, `migrations`

## Plan

### 1. Create seed data generator (`lib/pglite/seed/generate-seed-data.ts`)
- Function to generate 1000 fake users with deterministic UUIDs (reuse `incremental_consistent_uuid` pattern from db-tests)
- Function to generate 1000 fake dictionaries with varied properties (names, languages, entry counts, public/private mix, coordinates, etc.)
- Function to generate dictionary_roles connecting some users to some dictionaries as managers/contributors
- Use simple faker-like helpers (no heavy dependencies) - generate realistic-looking names, emails, dictionary names from word lists
- All data should be deterministic (same seed = same data) so DB resets produce consistent results

### 2. Create seed runner (`lib/pglite/seed/seed-pglite.ts`)
- Takes the drizzle db instance and PGlite pg instance
- Uses drizzle `db.insert()` to batch insert generated data
- Insert in correct order respecting FK constraints: users → user_data → dictionaries → dictionary_roles
- Batch inserts (e.g. 100 at a time) to avoid overwhelming PGlite
- Only runs when `is_new_db` is true

### 3. Hook into PGlite init (`lib/pglite/db.ts`)
- After migrations run and `is_new_db` is determined, call seed function
- Only seed in dev mode (`import.meta.env.DEV` or similar check)
- Add a `db_metadata` entry like `{ key: 'seeded', value: 'true' }` to track that seeding happened (belt and suspenders with `is_new_db`)

### 4. Coordinate with sync in admin layout
- Seeding happens inside `create_PG_lite()` before it returns, so by the time `+layout.ts` calls `sync.sync_with_notice()`, seed data is already present
- The `local_saved_at` trigger will mark seeded rows as dirty - need to decide: should seeded data sync up to Supabase or not?
  - **Recommendation**: Set `local_saved_at` to epoch (NULL after trigger) so seeded data is treated as "already synced" and doesn't push up to Supabase. The seed is just for local dev browsing.

## Questions to resolve
- Should seeded data have `local_saved_at = NULL` (treated as synced/clean) to avoid pushing fake data to Supabase on sync? (Recommended: yes)
- Should we keep the old `supabase/seed.sql` generation for Supabase-side seeding, or fully replace it?
- Do we want to seed dictionary_roles too, or just users and dictionaries?
- Should entries/senses be seeded too, or is that a separate concern (entries are not in the PGlite admin schema currently)?
