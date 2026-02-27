---
title: Implement PGlite usage in admin route
type: feature
priority: 2
---

# Implement PGlite Usage in Admin Route

## Status: COMPLETED ✓

All admin route components now use PGlite instead of `cached_query_data_store`.

## Completed Work

### 1. `/admin/+layout.ts` ✓
- Replaced `cached_query_data_store` with PGlite initialization
- Added `browser` check to prevent server-side execution
- Auto-syncs on route load via `sync.sync_with_notice()`
- `add_editor()` and `remove_editor()` now write to PGlite

### 2. `/admin/+layout.svelte` ✓
- Replaced "Reset cache" button with "Sync" button
- Shows "Syncing..." when sync in progress

### 3. `/admin/dictionaries/+page.svelte` ✓
- Changed from store subscriptions to `page.data.db`
- Removed `onMount`/`load_extras` pattern (data is reactive)

### 4. `/admin/dictionaries/DictionaryRow.svelte` ✓
- Removed `load_extras` prop
- Uses PGlite for invite cancellation

### 5. `/admin/users/+page.svelte` ✓
- Changed from store subscriptions to `page.data.db`
- Removed `load_data` callback

### 6. `/admin/users/UserRow.svelte` ✓
- Removed `load_data` and `dictionaries` props
- Uses PGlite for user_data unsubscribe toggle

## Type Notes

Using `as unknown as` casts for Date vs string timestamp mismatches. Future work could create unified types.

---

## Original Implementation Plan (for reference)

### Sync Behavior
- **Auto-sync on admin route load**: Sync automatically when navigating to `/admin`
- **Manual sync button**: Also allow user to trigger sync via button
- All data changes write to PGlite only; Supabase is only used by sync engine

### Step 1: Update `/admin/+layout.ts`

Replace `cached_query_data_store` with PGlite initialization. Use `browser` check to prevent server-side execution:

```ts
import { browser } from '$app/environment'
import { get_PG_lite } from '$lib/pglite/db'
import { Sync } from '$lib/pglite/sync/sync-engine.svelte'

export async function load({ parent }) {
  const { supabase } = await parent()

  // PGlite only runs in browser
  if (!browser) {
    return {
      db: null,
      sync: null,
      add_editor: async () => {},
      remove_editor: async () => {},
      inviteHelper,
    }
  }

  // Initialize PGlite (singleton, reused across navigation)
  const { live_db: db, db: drizzle_db, pg } = await get_PG_lite()

  // Create sync engine
  const sync = new Sync(drizzle_db, pg, supabase)

  // Auto-sync on route load
  sync.sync_with_notice()

  // Helper functions that write to PGlite
  async function add_editor({ role, dictionary_id, user_id }) {
    await db.dictionary_roles.insert({
      dictionary_id,
      user_id,
      role,
    })
  }

  async function remove_editor({ dictionary_id, user_id }) {
    // Delete all roles for this user on this dictionary
    const roles = db.dictionary_roles.rows.filter(
      r => r.dictionary_id === dictionary_id && r.user_id === user_id
    )
    for (const role of roles) {
      await role._delete()
    }
  }

  return {
    db,
    sync,
    add_editor,
    remove_editor,
    inviteHelper,
  }
}
```

### Step 2: Update `+layout.svelte`

Replace "Reset cache" button with Sync button:

```svelte
<Button
  type="button"
  class="ml-auto my-1"
  size="sm"
  form="simple"
  disabled={data.sync.is_syncing}
  onclick={() => data.sync.sync_with_notice()}>
  {#if data.sync.is_syncing}
    Syncing...
  {:else}
    Sync
  {/if}
</Button>
```

### Step 3: Update page components

Change from store subscriptions to `page.data.db`:

**Before (`+page.svelte`):**
```ts
const { users, dictionary_roles, admin_dictionaries } = $derived(data)

const users_with_roles = $derived($users.map(user => ({
  ...user,
  dictionary_roles: $dictionary_roles.filter(role => role.user_id === user.id),
})))
```

**After:**
```ts
import { page } from '$app/state'

const users_with_roles = $derived(
  page.data.db.users.rows.map(user => ({
    ...user,
    dictionary_roles: page.data.db.dictionary_roles.rows.filter(
      role => role.user_id === user.id
    ),
  }))
)
```

### Step 4: Update helper function usage in components

Components like `DictionaryRow.svelte` and `UserRow.svelte` use:
- `add_editor()` - will now write to PGlite
- `remove_editor()` - will now write to PGlite
- `supabase.from('invites').update()` - needs to change to PGlite
- `supabase.from('user_data').update()` - needs to change to PGlite

## Files to Modify

1. `packages/site/src/routes/admin/+layout.ts` - PGlite initialization, sync setup
2. `packages/site/src/routes/admin/+layout.svelte` - Sync button UI
3. `packages/site/src/routes/admin/dictionaries/+page.svelte` - Use `page.data.db`
4. `packages/site/src/routes/admin/users/+page.svelte` - Use `page.data.db`
5. `packages/site/src/routes/admin/dictionaries/DictionaryRow.svelte` - PGlite for invites
6. `packages/site/src/routes/admin/users/UserRow.svelte` - PGlite for user_data updates

## Data Flow After Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Route Load                        │
├─────────────────────────────────────────────────────────────┤
│  1. get_PG_lite() → singleton PGlite instance               │
│  2. new Sync(db, pg, supabase) → sync engine                │
│  3. sync.sync_with_notice() → auto-sync on load             │
│  4. Return { db: live_db, sync, helpers... }                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Component Usage                          │
├─────────────────────────────────────────────────────────────┤
│  • page.data.db.users.rows → reactive user list             │
│  • page.data.db.dictionaries.rows → reactive dict list      │
│  • page.data.db.dictionary_roles.rows → reactive roles      │
│  • page.data.db.invites.rows → reactive invites             │
│                                                             │
│  All reads are reactive (auto-update when PGlite changes)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    User Actions                             │
├─────────────────────────────────────────────────────────────┤
│  • add_editor() → PGlite insert (local_saved_at set)        │
│  • remove_editor() → PGlite delete (deletes table)          │
│  • Update invite status → invite._save()                    │
│  • Update user_data → user_data row._save()                 │
│                                                             │
│  All writes go to PGlite only (marked dirty for sync)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sync (Manual or Auto)                    │
├─────────────────────────────────────────────────────────────┤
│  1. Push local deletes to Supabase                          │
│  2. Pull remote deletes from Supabase                       │
│  3. Fetch cloud changes for each table                      │
│  4. Merge with local changes (last-write-wins)              │
│  5. Upload local dirty rows to Supabase                     │
│  6. Download cloud changes to PGlite                        │
│  7. Clear local_saved_at on synced rows                     │
└─────────────────────────────────────────────────────────────┘
```

## Notes

- The `inviteHelper` is an API call - keep as-is, no PGlite changes needed for invites.
- The admin route `+layout.ts` runs on both server and client, so use `browser` check to prevent PGlite from running on server.
- Components must handle `page.data.db` being `null` on server render (show loading state).
