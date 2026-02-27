---
title: Fix FK constraint error when syncing dictionary_roles after dictionary deletion
type: bug
priority: 1
---

## Problem

When a dictionary is deleted locally, `ON DELETE CASCADE` properly removes dependent rows from `dictionary_roles` and `invites`. However, the sync engine can then pull `dictionary_roles` rows from the cloud that reference the now-deleted dictionary, causing:

```
Error saving to dictionary_roles: Object error: insert or update on table "dictionary_roles" violates foreign key constraint "dictionary_roles_dictionary_id_fkey"
```

This happens because:
1. User deletes a dictionary locally (inserted into `deletes` table, cascade trigger removes dictionary + roles)
2. Sync pulls changes - tier 2 tables (`dictionary_roles`, `invites`) may include rows referencing the deleted dictionary
3. `save_to_local()` tries to INSERT/UPSERT these orphaned roles → FK violation

## Affected Tables

From `packages/site/src/lib/pglite/migrations/20260130_initial.sql`:
- `dictionary_roles` → `REFERENCES dictionaries(id) ON DELETE CASCADE`
- `invites` → `REFERENCES dictionaries(id) ON DELETE CASCADE`

## Sync Architecture Context

From `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts`:
- Sync tiers: `[['users', 'dictionaries'], ['user_data', 'dictionary_roles', 'invites']]`
- Tiers are synced in order, so dictionaries sync before dictionary_roles
- `save_to_local()` uses raw SQL INSERT...ON CONFLICT with no FK guard
- Deletes are synced separately via `sync_deletes()` after data sync

## Proposed Fix

In `save_to_local()`, catch FK constraint errors and skip/discard the row if the parent has been deleted locally (exists in `deletes` table). Alternatively, check if the referenced dictionary exists before inserting dependent rows.

### Option A: Try/catch with delete check (simplest)
Wrap the INSERT in save_to_local with a try/catch. On FK violation error (code 23503), check if the parent dictionary is in the local `deletes` table. If so, silently skip the row. If not, re-throw.

### Option B: Pre-filter pulled rows against local deletes
Before saving pulled tier-2 rows, filter out any whose `dictionary_id` matches a locally-deleted dictionary. This avoids the error entirely.

### Option C: Process deletes before pulling new data
Reorder sync to push/pull deletes first, then pull data. This way the dictionary would already be gone from cloud (or at least the delete recorded) before roles arrive.

## Test Plan

Add a test in `packages/site/src/lib/pglite/sync/sync-engine.test.ts` that:
1. Creates a dictionary and dictionary_role on device 1, syncs to cloud
2. Device 2 syncs to get both
3. Device 2 deletes the dictionary locally
4. Device 2 syncs again — should not error when cloud still has dictionary_roles for the deleted dictionary
5. Verify the dictionary and its roles are gone on device 2
6. Do the same for `invites` table

The existing test at line 542 (`dictionary delete syncs to cloud and cascades to other devices`) covers cross-device cascade but does NOT cover the scenario where the deleting device re-pulls stale dependent rows.

## Files to Modify

- `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts` — fix in `save_to_local()` or sync ordering
- `packages/site/src/lib/pglite/sync/sync-engine.test.ts` — add regression test
