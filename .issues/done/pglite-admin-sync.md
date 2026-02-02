---
title: Implement PGlite sync for admin route (users, dictionaries, dictionary_roles)
type: feature
priority: 2
---

# Implement PGlite Sync for Admin Route

## Overview
The PGlite folder was copied from another repo with a sync engine for user-specific tables. Adapt it to sync admin tables.

**Key changes:**
- Replace user tables (partners, chats, texts, etc.) with admin tables
- Remove words sync logic (composite key table not needed here)
- Remove `user_id` filtering - admin data is global
- Add `deletes` table for delete sync

## Current Admin Route Data Sources (Supabase)
- `dictionaries` from `dictionaries_view`
- `users` from `users_for_admin_table()` RPC function
- `dictionary_roles` from `dictionary_roles` table
- `user_data` from `user_data` table
- `invites` from `invites` table

## Tables Required for Admin
Be sure to look at the Supabase types from @living-dictionaries/types to be able to properly type the jsonb items.

### 1. `users` table (local PGlite)
Maps from Supabase `users_for_admin_table()` RPC:
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  updated_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone  -- for sync tracking
);
```

### 2. `dictionaries` table (local PGlite)
Maps from Supabase `dictionaries`:
```sql
CREATE TABLE dictionaries (
  id text PRIMARY KEY,
  name text NOT NULL,
  alternate_names text[],
  gloss_languages text[],
  location text,
  coordinates jsonb,
  iso_639_3 text,
  glottocode text,
  public boolean,
  print_access boolean,
  metadata jsonb,
  orthographies jsonb[],
  featured_image jsonb,
  author_connection text,
  community_permission text,  -- certainty enum: 'yes' | 'no' | 'unknown'
  language_used_by_community boolean,
  con_language_description text,
  copyright text,
  url text,
  created_at timestamp with time zone,
  created_by uuid,
  updated_at timestamp with time zone NOT NULL,
  updated_by uuid,
  local_saved_at timestamp with time zone  -- for sync tracking
);
```

### 3. `dictionary_roles` table (local PGlite)
Maps from Supabase `dictionary_roles`:
```sql
CREATE TABLE dictionary_roles (
  dictionary_id text NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,  -- role_enum: 'manager' | 'contributor'
  created_at timestamp with time zone NOT NULL,
  invited_by uuid,
  local_saved_at timestamp with time zone,  -- for sync tracking
  PRIMARY KEY (dictionary_id, user_id, role)
);
```

### 4. `user_data` table (local PGlite)
Maps from Supabase `user_data`:
```sql
CREATE TABLE user_data (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  about text,
  unsubscribed_from_emails timestamp with time zone,
  updated_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone
);
```

### 5. `invites` table (local PGlite)
Maps from Supabase `invites`:
```sql
CREATE TABLE invites (
  id uuid PRIMARY KEY,
  dictionary_id text NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_email text NOT NULL,
  role text NOT NULL,  -- role_enum: 'manager' | 'contributor'
  status text NOT NULL,  -- invite_status: 'queued' | 'sent' | 'accepted' | 'cancelled'
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  local_saved_at timestamp with time zone
);
```

### 6. `deletes` table (local PGlite)
```sql
CREATE TABLE deletes (
  table_name text NOT NULL,
  id text NOT NULL,  -- text to handle both uuid and text PKs
  local_saved_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (table_name, id)
);
```

## Implementation Tasks

### Task 1: Update schema.ts
Add Drizzle schema definitions for: `users`, `dictionaries`, `dictionary_roles`, `user_data`, `invites`, `deletes`

### Task 2: Update migration SQL
Update `migrations/20260130_initial.sql`:
- CREATE TABLE for all 6 tables
- Triggers for `local_saved_at` handling (see trigger code below)
- Trigger to cascade deletes when insert into `deletes` table (see trigger code below)
- FK constraints with proper cascading

### Task 3: Update sync types
Update `sync/types.ts`:
- Change `SyncableTableName` to `'users' | 'user_data' | 'dictionaries' | 'dictionary_roles' | 'invites'`

### Task 4: Update sync-engine.svelte.ts
- Replace `SYNC_TIERS` with admin tables:
  ```ts
  const SYNC_TIERS: SyncableTableName[][] = [
    ['users', 'dictionaries'], // Tier 1: no FK dependencies
    ['user_data', 'dictionary_roles', 'invites'], // Tier 2: depends on tier 1
  ]
  ```
- Remove all words sync logic (`fetch_and_merge_words`, `fetch_cloud_words`, etc.)
- Remove `user_id` filtering from cloud queries
- Change Supabase table names (no `user_*` prefix)
- Handle `users` fetch via RPC: `supabase.rpc('users_for_admin_table')`
- For uploads, write to actual tables (not views)
- **Users table is read-only** - no sync up for auth.users data
- **User_data syncs both ways** - download from and upload to `user_data` table

### Task 5: Integrate composite-changes.ts
Update `live/live-pglite.svelte.ts` to use `composite-changes.ts` for `dictionary_roles` table (has triple primary key: dictionary_id, user_id, role)

### Task 6: Update sync-engine.test.ts
- Replace partners/chats/chat_messages with users/dictionaries/dictionary_roles/user_data/invites
- Update `reset_supabase_user_data_sql` to reset admin tables
- Remove words table tests
- Test composite PK handling for dictionary_roles

## Trigger Code

### local_saved_at trigger
```sql
CREATE OR REPLACE FUNCTION set_local_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.local_saved_at = 'epoch'::timestamptz THEN
    NEW.local_saved_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.local_saved_at IS NULL THEN
    NEW.local_saved_at := now();
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';
```

### process_delete trigger
```sql
CREATE OR REPLACE FUNCTION process_delete()
RETURNS TRIGGER AS $$
BEGIN
  EXECUTE format('DELETE FROM %I WHERE id = $1', NEW.table_name) USING NEW.id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER process_delete_trigger
AFTER INSERT ON deletes
FOR EACH ROW EXECUTE FUNCTION process_delete();
```

## Data Source Mapping

| Local Table | Download From | Upload To |
|-------------|---------------|-----------|
| `users` | `users_for_admin_table()` RPC | Read-only |
| `user_data` | `user_data` table | `user_data` table |
| `dictionaries` | `dictionaries_view` | `dictionaries` table |
| `dictionary_roles` | `dictionary_roles` table | `dictionary_roles` table |
| `invites` | `invites` table | `invites` table |

## Files to Modify

1. `packages/site/src/lib/pglite/schema.ts` - Add table definitions
2. `packages/site/src/lib/pglite/migrations/20260130_initial.sql` - SQL tables + triggers
3. `packages/site/src/lib/pglite/sync/types.ts` - Update SyncableTableName
4. `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts` - Adapt for admin tables
5. `packages/site/src/lib/pglite/sync/sync-engine.test.ts` - Update tests
6. `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - Integrate composite-changes.ts for dictionary_roles
7. `packages/site/src/routes/admin/+layout.ts` - Wire up PGlite

## Supabase Changes Needed (separate PR)

The `users_for_admin_table()` RPC currently uses COALESCE for `updated_at`. This needs to be changed to return `updated_at` directly so incremental sync works. Also need to add `handle_updated_at` trigger on `auth.users` table if possible.
