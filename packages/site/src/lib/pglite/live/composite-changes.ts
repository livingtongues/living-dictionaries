/**
 * Composite key support for PGlite live.changes()
 *
 * This is adapted from @electric-sql/pglite's live extension to support
 * composite primary keys. The original only supports single-column keys.
 */

import type {
  PGliteInterface,
  Results,
  Transaction,
} from '@electric-sql/pglite'
import { formatQuery, uuid } from '@electric-sql/pglite'
import type { Change } from './types'

// --- Types ---

export interface CompositeChangesOptions<T = Record<string, any>> {
  query: string
  params?: any[] | null
  keys: string[]
  callback?: (changes: Change<T>[]) => void
  signal?: AbortSignal
}

export interface CompositeChangesResult<T = Record<string, any>> {
  fields: { name: string, dataTypeID: number }[]
  initialChanges: Change<T>[]
  subscribe: (callback: (changes: Change<T>[]) => void) => void
  unsubscribe: (
    callback?: (changes: Change<T>[]) => void,
  ) => Promise<void>
  refresh: () => Promise<void>
}
// --- Utilities copied from pglite internals ---

function debounce_mutex<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R | void> {
  let next:
    | {
      args: A
      resolve: (value: R | void) => void
      reject: (reason?: any) => void
    }
    | undefined

  let is_running = false

  const process_next = async () => {
    if (!next) {
      is_running = false
      return
    }
    is_running = true
    const { args, resolve, reject } = next
    next = undefined
    try {
      const ret = await fn(...args)
      resolve(ret)
    } catch (error) {
      reject(error)
    } finally {
      process_next()
    }
  }

  return (...args: A) => {
    if (next) {
      next.resolve(undefined)
    }
    const promise = new Promise<R | void>((resolve, reject) => {
      next = { args, resolve, reject }
    })
    if (!is_running) {
      process_next()
    }
    return promise
  }
}
async function get_tables_for_view(
  tx: Transaction | PGliteInterface,
  view_name: string,
): Promise<{ table_name: string, schema_name: string }[]> {
  const result = await tx.query<{
    table_name: string
    schema_name: string
  }>(
    `
      WITH RECURSIVE view_dependencies AS (
        SELECT DISTINCT
          cl.relname AS dependent_name,
          n.nspname AS schema_name,
          cl.relkind = 'v' AS is_view
        FROM pg_rewrite r
        JOIN pg_depend d ON r.oid = d.objid
        JOIN pg_class cl ON d.refobjid = cl.oid
        JOIN pg_namespace n ON cl.relnamespace = n.oid
        WHERE
          r.ev_class = (
              SELECT oid FROM pg_class WHERE relname = $1 AND relkind = 'v'
          )
          AND d.deptype = 'n'
        UNION ALL
        SELECT DISTINCT
          cl.relname AS dependent_name,
          n.nspname AS schema_name,
          cl.relkind = 'v' AS is_view
        FROM view_dependencies vd
        JOIN pg_rewrite r ON vd.dependent_name = (
          SELECT relname FROM pg_class WHERE oid = r.ev_class AND relkind = 'v'
        )
        JOIN pg_depend d ON r.oid = d.objid
        JOIN pg_class cl ON d.refobjid = cl.oid
        JOIN pg_namespace n ON cl.relnamespace = n.oid
        WHERE d.deptype = 'n'
      )
      SELECT DISTINCT
        dependent_name AS table_name,
        schema_name
      FROM view_dependencies
      WHERE NOT is_view;
    `,
    [view_name],
  )

  return result.rows.map(row => ({
    table_name: row.table_name,
    schema_name: row.schema_name,
  }))
}
async function add_notify_triggers_to_tables(
  tx: Transaction | PGliteInterface,
  tables: { table_name: string, schema_name: string }[],
  triggers_added: Set<string>,
) {
  const triggers = tables
    .filter(
      table =>
        !triggers_added.has(`${table.schema_name}_${table.table_name}`),
    )
    .map((table) => {
      return `
      CREATE OR REPLACE FUNCTION "_notify_${table.schema_name}_${table.table_name}"() RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify('table_change__${table.schema_name}__${table.table_name}', '');
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
      CREATE OR REPLACE TRIGGER "_notify_trigger_${table.schema_name}_${table.table_name}"
      AFTER INSERT OR UPDATE OR DELETE ON "${table.schema_name}"."${table.table_name}"
      FOR EACH STATEMENT EXECUTE FUNCTION "_notify_${table.schema_name}_${table.table_name}"();
      `
    })
    .join('\n')
  if (triggers.trim() !== '') {
    await tx.exec(triggers)
  }
  tables.map(table =>
    triggers_added.add(`${table.schema_name}_${table.table_name}`),
  )
}
// --- Main function ---

const MAX_RETRIES = 5
const table_notify_triggers_added = new Set<string>()

export async function composite_changes<T = Record<string, any>>(
  pg: PGliteInterface,
  options: CompositeChangesOptions<T>,
): Promise<CompositeChangesResult<T>> {
  const { query, params, keys, callback, signal } = options

  if (!keys || keys.length === 0) {
    throw new Error('keys is required for composite changes queries')
  }

  let callbacks: ((changes: Change<T>[]) => void)[] = callback
    ? [callback]
    : []
  const id = uuid().replace(/-/g, '')
  let dead = false

  let tables: { table_name: string, schema_name: string }[]
  let state_switch: 1 | 2 = 1
  let changes: Results<Change<T>>

  let unsub_list: ((tx?: Transaction) => Promise<void>)[]

  // Build SQL fragments for composite key handling
  const key_columns = keys.map(k => `"${k}"`).join(', ')
  const join_condition = keys
    .map(k => `curr."${k}" = prev."${k}"`)
    .join(' AND ')
  const after_expr = `ROW(${key_columns})::text`

  const init = async () => {
    await pg.transaction(async (tx) => {
      const formatted_query = await formatQuery(pg, query, params, tx)
      await tx.query(
        `CREATE OR REPLACE TEMP VIEW live_query_${id}_view AS ${formatted_query}`,
      )

      tables = await get_tables_for_view(tx, `live_query_${id}_view`)
      await add_notify_triggers_to_tables(
        tx,
        tables,
        table_notify_triggers_added,
      )

      const columns = [
        ...(
          await tx.query<any>(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'live_query_${id}_view'
          `)
        ).rows,
        { column_name: '__after__', data_type: 'text' },
      ]

      await tx.exec(`
        CREATE TEMP TABLE live_query_${id}_state1 (LIKE live_query_${id}_view INCLUDING ALL);
        CREATE TEMP TABLE live_query_${id}_state2 (LIKE live_query_${id}_view INCLUDING ALL);
      `)

      for (const curr of [1, 2]) {
        const prev = curr === 1 ? 2 : 1
        await tx.exec(`
          PREPARE live_query_${id}_diff${curr} AS
          WITH
            prev AS (SELECT LAG(${after_expr}) OVER () as __after__, * FROM live_query_${id}_state${prev}),
            curr AS (SELECT LAG(${after_expr}) OVER () as __after__, * FROM live_query_${id}_state${curr}),
            data_diff AS (
              SELECT 
                'INSERT' AS __op__,
                ${columns
                  .map(
                    ({ column_name }) =>
                      `curr."${column_name}" AS "${column_name}"`,
                  )
                  .join(',\n                ')},
                ARRAY[]::text[] AS __changed_columns__
              FROM curr
              LEFT JOIN prev ON ${join_condition}
              WHERE ${keys.map(k => `prev."${k}" IS NULL`).join(' AND ')}
            UNION ALL
              SELECT 
                'DELETE' AS __op__,
                ${columns
                  .map(({ column_name, data_type, udt_name }) => {
                    if (keys.includes(column_name)) {
                      return `prev."${column_name}" AS "${column_name}"`
                    }
                    return `NULL${data_type === 'USER-DEFINED' ? `::${udt_name}` : ``} AS "${column_name}"`
                  })
                  .join(',\n                ')},
                ARRAY[]::text[] AS __changed_columns__
              FROM prev
              LEFT JOIN curr ON ${join_condition}
              WHERE ${keys.map(k => `curr."${k}" IS NULL`).join(' AND ')}
            UNION ALL
              SELECT 
                'UPDATE' AS __op__,
                ${columns
                  .map(({ column_name, data_type, udt_name }) =>
                    keys.includes(column_name)
                      ? `curr."${column_name}" AS "${column_name}"`
                      : `CASE 
                          WHEN curr."${column_name}" IS DISTINCT FROM prev."${column_name}" 
                          THEN curr."${column_name}"
                          ELSE NULL${data_type === 'USER-DEFINED' ? `::${udt_name}` : ``}
                          END AS "${column_name}"`,
                  )
                  .join(',\n                ')},
                ARRAY(SELECT unnest FROM unnest(ARRAY[${columns
                  .filter(({ column_name }) => !keys.includes(column_name))
                  .map(
                    ({ column_name }) =>
                      `CASE
                        WHEN curr."${column_name}" IS DISTINCT FROM prev."${column_name}" 
                        THEN '${column_name}' 
                        ELSE NULL 
                        END`,
                  )
                  .join(
                    ', ',
                  )}]) WHERE unnest IS NOT NULL) AS __changed_columns__
              FROM curr
              INNER JOIN prev ON ${join_condition}
              WHERE NOT (curr IS NOT DISTINCT FROM prev)
            )
          SELECT * FROM data_diff;
        `)
      }

      unsub_list = await Promise.all(
        tables!.map(table =>
          tx.listen(
            `"table_change__${table.schema_name}__${table.table_name}"`,
            () => {
              refresh()
            },
          ),
        ),
      )
    })
  }

  await init()

  const refresh = debounce_mutex(async () => {
    if (callbacks.length === 0 && changes) {
      return
    }
    let reset = false
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        await pg.transaction(async (tx) => {
          await tx.exec(`
            INSERT INTO live_query_${id}_state${state_switch} 
              SELECT * FROM live_query_${id}_view;
          `)

          changes = await tx.query<any>(
            `EXECUTE live_query_${id}_diff${state_switch};`,
          )

          state_switch = state_switch === 1 ? 2 : 1

          await tx.exec(`
            TRUNCATE live_query_${id}_state${state_switch};
          `)
        })
        break
      } catch (error) {
        const msg = (error as Error).message
        if (
          msg
          === `relation "live_query_${id}_state${state_switch}" does not exist`
        ) {
          reset = true
          await init()
          continue
        } else {
          throw error
        }
      }
    }

    run_change_callbacks(callbacks, [
      ...(reset
        ? [
            {
              __op__: 'RESET' as const,
            } as Change<T>,
          ]
        : []),
      ...changes!.rows,
    ])
  })

  const subscribe = (callback: (changes: Change<T>[]) => void) => {
    if (dead) {
      throw new Error(
        'Live query is no longer active and cannot be subscribed to',
      )
    }
    callbacks.push(callback)
  }

  const unsubscribe = async (
    callback?: (changes: Change<T>[]) => void,
  ) => {
    if (callback) {
      callbacks = callbacks.filter(cb => cb !== callback)
    } else {
      callbacks = []
    }
    if (callbacks.length === 0 && !dead) {
      dead = true
      await pg.transaction(async (tx) => {
        await Promise.all(unsub_list.map(unsub => unsub(tx)))
        await tx.exec(`
          DROP VIEW IF EXISTS live_query_${id}_view;
          DROP TABLE IF EXISTS live_query_${id}_state1;
          DROP TABLE IF EXISTS live_query_${id}_state2;
          DEALLOCATE live_query_${id}_diff1;
          DEALLOCATE live_query_${id}_diff2;
        `)
      })
    }
  }

  if (signal?.aborted) {
    await unsubscribe()
  } else {
    signal?.addEventListener(
      'abort',
      () => {
        unsubscribe()
      },
      { once: true },
    )
  }

  await refresh()

  const fields = changes!.fields.filter(
    field =>
      !['__after__', '__op__', '__changed_columns__'].includes(field.name),
  )

  return {
    fields,
    initialChanges: changes!.rows,
    subscribe,
    unsubscribe,
    refresh,
  }
}

function run_change_callbacks<T>(
  callbacks: ((changes: Change<T>[]) => void)[],
  changes: Change<T>[],
) {
  for (const callback of callbacks) {
    callback(changes)
  }
}
