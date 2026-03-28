---
title: Admin sync dashboard page at /admin/sync
type: feature
priority: 2
---

## Goal

Create a sync dashboard page at `/admin/sync` modeled after the tutor app's `/sync/+page.svelte`. This gives admins visibility into sync operations with a live log stream, summary cards, and report download/copy functionality.

## Reference

Tutor sync page: `/home/jacob/code/tutor/app/src/routes/(app)/sync/+page.svelte`

## Key Differences from Tutor

1. **No CSS variables** — tutor uses `var(--primary)`, `var(--surface)`, etc. We must use hardcoded Tailwind colors (e.g. `blue-600`, `gray-100`, `gray-500`)
2. **No i18n** — tutor uses `page.data.t.sync.*` translations. Admin panel uses hardcoded English strings already, so we'll do the same.
3. **No `log_entries`** — LD's `Sync` class currently only uses `console.log`. We need to add a `log_entries` reactive array and `#log()` method to the sync engine, replacing/supplementing the existing `console.log` calls.
4. **No `SyncLogEntry` type** — needs to be added to `packages/site/src/lib/pglite/sync/types.ts`
5. **No `Pod` component** — tutor uses a custom shell component. We're inside the admin layout which already has Header + tabs.
6. **No download-report helper** — needs to be created

## Implementation Plan

### 1. Add `SyncLogEntry` type to `packages/site/src/lib/pglite/sync/types.ts`

```ts
export interface SyncLogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  phase: string
  table?: string
  message: string
  detail?: string
  row_count?: number
}
```

### 2. Add logging to `Sync` class in `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts`

Add two new reactive properties and a private method:

```ts
log_entries: SyncLogEntry[] = $state([])

#log(entry: Omit<SyncLogEntry, 'timestamp'>) {
  this.log_entries.push({ ...entry, timestamp: new Date() })
}
```

Replace all `console.log('[sync]...')` calls with `this.#log(...)` calls using appropriate level/phase/table/message. Keep `console.error` calls but also add corresponding `#log` error entries. Clear `log_entries` at the start of each `sync()` call.

**Specific log points to add (mapping existing console.logs + new ones):**

- `sync()` start: `{ level: 'info', phase: 'start', message: 'Starting sync' }`
- After getting `synced_up_to`: `{ level: 'info', phase: 'start', message: 'Synced up to: ...' }`
- Delete sync start: `{ level: 'info', phase: 'deletes', message: 'Syncing deletes...' }`
- Delete sync result: `{ level: 'info', phase: 'deletes', message: 'Deletes complete', row_count: pushed + pulled }`
- `fetch_cloud_changes` per table: `{ level: 'info', phase: 'fetch', table, message: 'Fetched N rows from ...', row_count }`
- `fetch_from_rpc`: same pattern with table 'users'
- Processing tier: `{ level: 'info', phase: 'write', message: 'Processing tier: ...' }`
- Download per table: `{ level: 'info', phase: 'download', table, message: 'Downloading N rows', row_count }`
- Upload per table: `{ level: 'info', phase: 'upload', table, message: 'Uploading N rows', row_count }`
- Errors: `{ level: 'error', phase: relevant_phase, table, message: error_msg }`
- Sync complete: `{ level: 'success', phase: 'complete', message: 'Sync complete in Nms' }`

### 3. Create download report helper at `packages/site/src/routes/admin/sync/download-report.ts`

Port from tutor's version. Two functions:
- `generate_sync_report_text({ log_entries, result })` — returns string
- `download_sync_report({ log_entries, result })` — triggers file download

Remove `user_id` param (admin context, not needed) or keep it optional.

### 4. Add Tab link in admin layout `packages/site/src/routes/admin/+layout.svelte`

Add a `sync` tab alongside the existing tabs:
```svelte
<Tab link="sync" label="sync" />
```

Replace the existing inline Sync button with a cloud icon link to `/admin/sync`. The icon should reflect the last sync status (spinning if syncing, check if success, alert if error). Sync auto-runs on admin page load already, so the nav just needs a status indicator + link, not a trigger.

### 5. Create page at `packages/site/src/routes/admin/sync/+page.svelte`

Port from tutor's sync page with these adaptations:

**Color mapping (CSS vars → hardcoded Tailwind):**
| Tutor CSS var | Hardcoded replacement |
|---|---|
| `var(--primary)` | `blue-600` |
| `var(--surface)` | `gray-100` |
| `var(--background)` | `white` / `gray-50` |
| `var(--color-secondary)` | `gray-500` |
| `var(--on-primary)` | `white` |

**Structure (same as tutor):**
1. Status + Actions bar (syncing indicator, start sync button, copy button, download button)
2. Summary cards grid (4 cards: uploaded, downloaded, deletes, errors)
3. Log stream div with auto-scroll, monospace, color-coded by level

**Key differences in implementation:**
- No `Pod` component needed (admin layout provides header)
- No `page.data.t(...)` calls — use hardcoded English strings
- Access sync via `page.data.sync` (already available from admin layout load)
- No `onMount` auto-sync (admin layout already auto-syncs on load)
- Height calculation: use `flex-1 min-h-0` instead of `calc(100vh - 52px)` since we're inside admin layout container
- Use existing project button patterns (check what `Button` from `$lib/svelte-pieces` offers vs raw `<button>` elements)

### 6. No +page.ts needed

`data.sync` is already provided by the admin `+layout.ts` — no additional load function needed.

## Files to Create/Modify

| File | Action |
|---|---|
| `packages/site/src/lib/pglite/sync/types.ts` | Add `SyncLogEntry` interface |
| `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts` | Add `log_entries`, `#log()`, replace console.logs |
| `packages/site/src/routes/admin/sync/download-report.ts` | Create (port from tutor) |
| `packages/site/src/routes/admin/sync/+page.svelte` | Create (port from tutor, hardcoded colors) |
| `packages/site/src/routes/admin/+layout.svelte` | Add sync tab, remove inline sync button |

### 7. Port batch improvements from tutor's sync engine into LD's sync engine

The tutor sync engine has several batch optimizations that the LD engine is missing. These should be ported to `packages/site/src/lib/pglite/sync/sync-engine.svelte.ts`:

#### 7a. Batch upload mark-as-synced (single SQL instead of per-row)

**Current LD code** in `upload_to_supabase()`: After uploading, it loops over each returned row and runs an individual `UPDATE ... SET local_saved_at` query per row. This is O(n) queries.

**Tutor improvement** in `write_table_changes()`: After uploading, it builds a single batch UPDATE using a VALUES clause:
```sql
UPDATE table SET
  updated_at = batch.updated_at,
  local_saved_at = $sentinel
FROM (VALUES ($1::uuid, $2::timestamptz), ...) AS batch(id, updated_at)
WHERE table.id = batch.id
```
This is 1 query regardless of row count. Port this pattern for all id-based tables. For composite PK tables (`dictionary_roles`), build the batch with composite key columns instead.

#### 7b. Batch download inserts (single SQL instead of per-row)

**Current LD code** in `write_table_changes()` download section: Loops `for (const item of to_download)` and calls `save_to_local()` per row, which runs one INSERT per row. This is O(n) queries.

**Tutor improvement** `save_batch_to_local()`: Builds a single multi-row INSERT:
```sql
INSERT INTO table (col1, col2, ...) VALUES ($1, $2, ...), ($3, $4, ...), ...
ON CONFLICT ("id") DO UPDATE SET col1 = EXCLUDED.col1, ...
```
Port this as a `save_batch_to_local()` method. Process downloads in batches of ~200 rows. For composite PK tables, adjust the ON CONFLICT clause to use the composite key columns.

#### 7c. Add `#yield()` helper for UI responsiveness

Tutor has `async #yield() { await new Promise(resolve => setTimeout(resolve, 0)) }` and calls it between batch operations so the UI thread can process log entry updates and render. Add the same.

#### 7d. Files to modify for batch improvements

| File | Changes |
|---|---|
| `sync-engine.svelte.ts` | Replace per-row upload mark-synced with batch UPDATE; replace per-row `save_to_local` in download loop with `save_batch_to_local`; add `#yield()` |

**Note**: The tutor also has word-specific batch logic (composite key: word+language). LD's equivalent is `dictionary_roles` (composite key: dictionary_id+user_id+role). The batch patterns need to handle both id-based and composite PK tables.

## Testing

- ✅ `pnpm check` — 0 errors
- ✅ `pnpm vitest run` — 136 tests pass
- Navigate to `/admin/sync` and verify the page renders
- Click "Start Sync" and verify log entries stream in with auto-scroll
- Verify summary cards appear after sync completes
- Test copy and download buttons
- Verify the cloud icon in nav reflects sync status
