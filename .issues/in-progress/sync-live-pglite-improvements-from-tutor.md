---
title: Sync live-pglite improvements from tutor repo
type: task
priority: 2
---

The tutor repo's `live-pglite` has evolved with several improvements that should be ported to living-dictionaries. This covers changes to both `live-pglite.svelte.ts`, `table-store.svelte.ts`, and `types.ts`.

## Changes to port

### 1. ✅ Rename `delete_all` to `delete` and accept `string | string[]`

**Tutor API:** `.delete(ids: string | string[])` - accepts single id or array
**LD API:** `.delete_all(ids: string[])` - only accepts array

Changes needed:
- `packages/site/src/lib/pglite/live/types.ts` - rename `delete_all` to `delete` in `TableAccessor`, change param to `string | string[]`
- `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - rename `delete_all` method in accessor and `#delete_all` private method to `#delete`, add `Array.isArray` normalization

**Usage sites to update:** None found - `delete_all` is not currently called anywhere in app code (only `_delete()` on rows is used).

### 2. ✅ Add `.find(id)` async non-reactive lookup

Tutor has `find(row_id: string): Promise<RowType<T> | undefined>` which does a direct `SELECT * WHERE id = $1` without creating a live subscription. Useful for one-off lookups.

Changes needed:
- `packages/site/src/lib/pglite/live/types.ts` - add `find` to `TableAccessor`
- `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - add `find` method to accessor

For composite key tables, `find` accepts a composite key string (e.g., `"dict_id|user_id|role"`) matching the existing `#get_row_by_id` pattern. The key is split on `|` to get individual PK values.

### 3. ✅ Add `.upsert()` method

Tutor has `upsert(set: InsertType<T> | InsertType<T>[]): Promise<RowType<T>[]>` which does `INSERT ... ON CONFLICT ... DO UPDATE SET ...`. Use `ON CONFLICT (pk_columns)` syntax (not `ON CONSTRAINT {table}_pkey`) to match the existing pattern in `sync-engine.svelte.ts`. Exclude PK columns and `created_at` from the UPDATE SET clause.

Changes needed:
- `packages/site/src/lib/pglite/live/types.ts` - add `upsert` to `TableAccessor`, add `UpdateType` 
- `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - add `upsert` method and `#upsert` private implementation

### 4. ✅ Add `.update()` partial update method

Tutor has `update(set: UpdateType<T>): Promise<void>` for updating specific fields by id without loading the row first. `UpdateType` is `Partial<InsertType> & { id: string }`.

Changes needed:
- `packages/site/src/lib/pglite/live/types.ts` - add `UpdateType` and `update` to `TableAccessor`
- `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - add `update` method and `#update` private implementation

Note: For composite key tables, `UpdateType` requires all PK fields plus any fields to update. At the type level, use `Partial<InsertType<T>> & { id: string }` as the base (matching tutor) with runtime validation ensuring all PK columns are present for composite key tables.

### 5. ✅ Add `.snapshot()` to `QueryAccessor`

Tutor's `QueryAccessor` has `snapshot(): Promise<RawRowType<T>[]>` for non-reactive one-time reads of query results.

Changes needed:
- `packages/site/src/lib/pglite/live/types.ts` - add `snapshot` to `QueryAccessor`, import `RawRowType`
- `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - add `snapshot` to `#create_query_accessor` return

### 6. ✅ Add debounced stop to `TableStore`

Tutor's `TableStore` has a `#schedule_stop()` method with a 5-second timeout before unsubscribing. This prevents rapid subscribe/unsubscribe cycles when navigating between pages. LD currently stops immediately.

Changes needed:
- `packages/site/src/lib/pglite/live/table-store.svelte.ts`:
  - Add `#stop_timeout` field
  - Add `#schedule_stop()` method with 5s debounce
  - Replace direct `this.#stop()` calls in cleanup with `this.#schedule_stop()`
  - Clear timeout in `#start()` if pending
  - Don't add subscription tracking to `loading` getter — in practice `.loading` is always accessed alongside `.rows` or `.objects` which already trigger subscriptions

### 7. Remove hardcoded `TABLE_PRIMARY_KEYS` / `READ_ONLY_TABLES` / `NO_DELETE_TABLES`

The tutor repo simplified by removing these config objects and always using `id` as primary key. LD needs these for composite key tables so this is NOT a change to port - just noting the difference. LD's approach with `primary_keys` config, composite key support, and read-only table handling is more sophisticated and correct for its schema.

### 8. Make `on_save`/`on_delete`/`on_reset` optional in `TableStoreConfig`

Tutor makes these optional (for read-only use cases). LD already handles this correctly with its `READ_ONLY_TABLES` set - the callbacks are conditionally passed. No change needed, just noting parity.

### 9. ✅ Update AGENTS.md documentation

After adding the new methods, update the "UI Database Interaction using Live PGlite" section in `AGENTS.md` to document:
- `.find(id)` — async non-reactive single row lookup
- `.upsert(data)` — insert or update on conflict
- `.update(data)` — partial update by id
- `.delete(ids)` — renamed from `delete_all`, accepts `string | string[]`
- `.query().snapshot()` — one-time non-reactive read of query results
- Update the Table Accessor Properties table at the bottom

## Summary of files to modify

1. `packages/site/src/lib/pglite/live/types.ts` - add `find`, `upsert`, `update`, `UpdateType`, rename `delete_all` → `delete`, add `snapshot` to `QueryAccessor`
2. `packages/site/src/lib/pglite/live/live-pglite.svelte.ts` - implement `find`, `upsert`, `update`, rename `delete_all` → `delete`, add `snapshot`
3. `packages/site/src/lib/pglite/live/table-store.svelte.ts` - add debounced stop
4. `AGENTS.md` - update Live PGlite documentation section

No app code changes needed since `delete_all` isn't called anywhere in current app code.

## Verification

- Run `pnpm check` to verify types compile correctly
- Run `pnpm test` to ensure no regressions
- Manual browser test: log in, navigate between dictionary pages to verify debounced stop doesn't cause stale data issues
