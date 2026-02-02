# Composite Changes for PGlite

This module provides `composite_changes()`, a function that extends PGlite's `live.changes()` to support composite primary keys.

## Why this exists

PGlite's built-in `live.changes()` only accepts a single `key` parameter (e.g., `"id"`). If your table has a composite primary key like `(user_id, item_id)`, you can't use it directly.

This implementation is adapted from PGlite's internal code with modifications to handle multiple key columns.

## Usage

```typescript
import { composite_changes } from '$lib/pglite/live/composite-changes'
import type { PGliteInterface } from '@electric-sql/pglite'

const pg: PGliteInterface = /* your pglite instance */

const result = await composite_changes(pg, {
  query: 'SELECT * FROM user_items WHERE active = $1',
  params: [true],
  keys: ['user_id', 'item_id'],  // <-- composite key
  callback: (changes) => {
    for (const change of changes) {
      switch (change.__op__) {
        case 'INSERT':
          console.log('New row:', change)
          break
        case 'UPDATE':
          console.log('Updated:', change.__changed_columns__, change)
          break
        case 'DELETE':
          console.log('Deleted row with keys:', change.user_id, change.item_id)
          break
        case 'RESET':
          console.log('State was reset, refetch everything')
          break
      }
    }
  },
})

// Initial changes are also available
console.log(result.initialChanges)

// Clean up when done
await result.unsubscribe()
```

## API

### `composite_changes<T>(pg, options)`

**Parameters:**

- `pg: PGliteInterface` - Your PGlite instance
- `options: CompositeChangesOptions<T>`:
  - `query: string` - SQL query to watch
  - `params?: any[]` - Query parameters
  - `keys: string[]` - Column names that form the composite primary key
  - `callback?: (changes: Change<T>[]) => void` - Called on each change
  - `signal?: AbortSignal` - Optional abort signal

**Returns:** `Promise<CompositeChangesResult<T>>`

- `fields` - Column metadata
- `initialChanges` - Initial set of changes (all rows as INSERTs)
- `subscribe(callback)` - Add another listener
- `unsubscribe(callback?)` - Remove listener(s)
- `refresh()` - Manually trigger a refresh

## Change types

Each change has an `__op__` field:

- `INSERT` - New row added. All columns populated.
- `DELETE` - Row removed. Only key columns populated, others are `null`.
- `UPDATE` - Row modified. Key columns always populated. Other columns are `null` unless they changed. Check `__changed_columns__` for which columns changed.
- `RESET` - Internal state was lost (e.g., multi-tab worker scenario). Treat as "start fresh".

## How it works

1. Creates a temp view from your query
2. Maintains two state tables that alternate storing the previous/current state
3. On any underlying table change, diffs the two states using SQL
4. Returns only the delta (INSERT/UPDATE/DELETE operations)

This is efficient for large result sets with small changes - only the diff is returned, not all 10,000 rows.

## Differences from `live.changes()`

| Feature          | `live.changes()` | `composite_changes()` |
| ---------------- | ---------------- | --------------------- |
| Single key       | ✅               | ✅                    |
| Composite key    | ❌               | ✅                    |
| `__after__` type | `number`         | `string` (ROW tuple)  |

## Maintenance notes

This code is adapted from `@electric-sql/pglite` version 0.3.11. If PGlite updates their live query internals significantly, this may need updates. The copied utilities are:

- `debounce_mutex` - Ensures only one refresh runs at a time
- `get_tables_for_view` - Finds tables used by a view
- `add_notify_triggers_to_tables` - Sets up change notifications
