/**
 * Client-importable bundle of `dictionaries/{id}.db` migrations.
 *
 * The server has its own `LATEST_DICT_MIGRATION` in `lib/db/server/dictionary-db.ts`
 * but that file uses `node:fs` and isn't importable from the browser. This
 * module mirrors the same glob — `import.meta.glob` inlines the SQL contents
 * at build time, so the worker bundle ships with the latest migrations baked
 * in (~5–10 KB raw, well under any size budget).
 *
 * Discipline (Q10.5): every migration must be additive at any given moment in
 * time. Destructive changes (DROP/RENAME COLUMN) go through multi-phase
 * deploys so old client bundles can still read the latest R2 snapshot.
 */

const migration_glob = import.meta.glob('../schemas/dictionary-migrations/*.sql', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/**
 * Map of migration filename → raw SQL. Keyed by filename only (path stripped)
 * so the worker can iterate in lexicographic order.
 */
export const DICT_MIGRATIONS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(migration_glob).map(([path, sql]) => [path.split('/').pop()!, sql]),
  ),
)

/** Sorted migration filenames (lexicographic). */
export const DICT_MIGRATION_NAMES: readonly string[] = Object.freeze(
  Object.keys(DICT_MIGRATIONS).sort(),
)

/** Lexicographically-last migration filename. Empty string if no migrations. */
export const LATEST_DICT_MIGRATION: string
  = DICT_MIGRATION_NAMES[DICT_MIGRATION_NAMES.length - 1] || ''
