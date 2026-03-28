---
title: Refactor delete dictionary from API endpoint to script
type: task
priority: 3
---

## Summary

Remove the `api_delete_dictionary` API endpoint and move its logic into a standalone script in `packages/scripts/`. Dictionary deletion is an admin-only, infrequent operation that doesn't need to be a live API endpoint. There's already a `delete-dictionary-media` script that handles the second half of the process (actually deleting media files from storage), so this new script would handle the first half (queuing media for deletion and removing the dictionary row).

## Current Architecture

### API Endpoint (to be removed)
- **`packages/site/src/routes/api/db/delete-dictionary/+server.ts`** - POST endpoint requiring admin auth that:
  1. Fetches all `audio`, `photos`, `videos` storage paths for the dictionary
  2. Inserts them into `media_to_delete` table
  3. Deletes the dictionary row from `dictionaries` table (all related rows cascade due to `ON DELETE CASCADE`)
  4. Sends admin email notification via `$api/email/delete_dictionary`
- **`packages/site/src/routes/api/db/delete-dictionary/_call.ts`** - Client-side caller (`api_delete_dictionary` function, exported as `n` currently)

### Admin UI caller
- **`packages/site/src/routes/admin/dictionaries/DictionaryRow.svelte`** - Has a Delete button with confirmation modal that calls `api_delete_dictionary`

### Existing media deletion script
- **`packages/scripts/delete-dictionary-media/index.ts`** - Reads from `media_to_delete` table and deletes files from S3/GCloud storage using `@aws-sdk/client-s3`. Supports `--live` flag (dry run by default).

### Email notification
- **`packages/site/src/routes/api/email/delete_dictionary/index.ts`** - Sends admin notice email about deletion

## Database Notes
- All tables with `dictionary_id` reference `dictionaries ON DELETE CASCADE`, so deleting the dictionary row automatically cleans up words, senses, audio, photos, videos, dictionary_roles, invites, etc.
- The `media_to_delete` table stores `{dictionary_id, storage_path}` for later processing by the media deletion script.

## Plan

### 1. Create new delete-dictionary script
Create `packages/scripts/delete-dictionary/index.ts` that:
- Takes a `dictionary_id` argument via commander
- Uses `admin_supabase` from `../config-supabase`
- Fetches audio, photos, videos storage paths for the dictionary
- Inserts them into `media_to_delete` table
- Deletes the dictionary row from `dictionaries` table
- Logs what was done
- Supports `--live` flag like the media deletion script (dry run by default)
- Optionally could also run the media deletion step inline or remind user to run `delete-dictionary-media` next

### 2. Update admin UI
- In `DictionaryRow.svelte`, replace the `api_delete_dictionary` call with a direct PGlite delete (just `dictionary._delete()`) since this just needs to work locally, and the actual Supabase deletion will be done via the script
- OR remove the delete button from the UI entirely and make deletion script-only
- Need to decide: should the UI still allow triggering deletion, or should it be script-only?

### 3. Remove API endpoint files
- Delete `packages/site/src/routes/api/db/delete-dictionary/+server.ts`
- Delete `packages/site/src/routes/api/db/delete-dictionary/_call.ts`

### 4. Handle email notification
- Decide if the script should also send the email notification, or if that's no longer needed since it's a manual admin action
- If keeping, may need to extract `send_email` into a shared utility usable from scripts

## Questions to Resolve
- Should the admin UI keep a delete button that works locally via PGlite, or should deletion be entirely script-based?
- Should the new script also run the media deletion step, or keep them as separate scripts?
- Is the admin email notification still desired when deletion is done via script?
