# Admin Data Flow

## Initialization
1. `/admin/+layout.ts` initializes PGlite singleton (`get_PG_lite()`) with `browser` check
2. Creates `Sync` engine, auto-syncs on route load
3. Returns `{ db: live_db, sync, add_editor, remove_editor }` to child routes

## Component Usage
All reads are reactive via `page.data.db`:
```ts
page.data.db.users.rows        // reactive user list
page.data.db.dictionaries.rows // reactive dictionary list
page.data.db.dictionary_roles.rows
page.data.db.invites.rows
```

## Write Pattern
All writes go to PGlite only (marked dirty via `local_saved_at` trigger):
- `add_editor()` → PGlite insert on `dictionary_roles`
- `remove_editor()` → PGlite delete (writes to `deletes` table)
- Invite status updates → `invite._save()`
- User data updates → `user_data` row `._save()`

Supabase is only written to during sync.

## Type Notes
Using `as unknown as` casts for Date vs string timestamp mismatches between PGlite and Supabase types. Future work could create unified types.
