# PGlite Admin Sync

## Overview
PGlite sync engine (ported from tutor) adapted for admin tables. Key differences from tutor's sync:
- No `user_id` filtering — admin data is global
- No words sync logic (no composite key tables except dictionary_roles)
- `users` table is read-only (synced down from `users_for_admin_table()` RPC, never pushed up)

## Tables
| Local Table | Download From | Upload To |
|-------------|---------------|-----------|
| `users` | `users_for_admin_table()` RPC | Read-only |
| `user_data` | `user_data` table | `user_data` table |
| `dictionaries` | `dictionaries_view` | `dictionaries` table |
| `dictionary_roles` | `dictionary_roles` table | `dictionary_roles` table |
| `invites` | `invites` table | `invites` table |

## Sync Tiers (FK dependency order)
1. `users`, `dictionaries` — no FK dependencies
2. `user_data`, `dictionary_roles`, `invites` — depend on tier 1

## Composite PK Handling
`dictionary_roles` has triple primary key: `(dictionary_id, user_id, role)`. Uses `composite-changes.ts` for change tracking in `live-pglite.svelte.ts`.

## Trigger Patterns
Same `set_local_saved_at` and `process_delete` triggers as tutor — see [tutor's sqlite-sync-engine knowledge](../../../tutor/.knowledge/architecture/sqlite-sync-engine.md) for the core patterns. Note: tutor has since migrated to SQLite but LD still uses PGlite.
