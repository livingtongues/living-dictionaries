import type { PGlite } from '@electric-sql/pglite'
import type { Migration } from './types'
import { live, type LiveNamespace } from '@electric-sql/pglite/live'
import { PGliteWorker } from '@electric-sql/pglite/worker'
import { drizzle } from 'drizzle-orm/pglite'
import { create_live_pglite } from './live/live-pglite.svelte'
import * as schema from './schema'

type LivePGLite = PGlite & {
  live: LiveNamespace
}

const DB_ID_KEY = 'ld_pglite_db_id'

function get_db_id() {
  const db_id = localStorage.getItem(DB_ID_KEY)
  if (db_id) {
    console.log('Found existing db id:', db_id)
    return db_id
  }
  const new_db_id = crypto.randomUUID()
  console.log('Creating new db id:', new_db_id)
  localStorage.setItem(DB_ID_KEY, new_db_id)
  return new_db_id
}

let db_instance: Awaited<ReturnType<typeof create_PG_lite>> | null = null
let db_promise: ReturnType<typeof create_PG_lite> | null = null

export async function get_PG_lite() {
  if (db_instance)
    return db_instance
  if (!db_promise) {
    db_promise = create_PG_lite()
  }
  db_instance = await db_promise
  return db_instance
}

async function create_PG_lite() {
  const db_id = get_db_id()

  const pg = await PGliteWorker.create(
    new Worker(new URL('./pglite-worker.js', import.meta.url), { type: 'module' }),
    {
      dataDir: `idb://${db_id}`,
      extensions: {
        live,
      },
    },
  ) as unknown as LivePGLite
  await pg.waitReady

  const _db = drizzle({ client: pg, schema })
  const db = Object.assign(_db, {
    schema,
  })

  const tables = await pg.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
  )
  const was_resumed = tables.rows.length > 0

  const migration_names = await run_needed_migrations(pg, was_resumed)
  if (migration_names.length) {
    await db.insert(db.schema.migrations).values(
      migration_names.map(name => ({ name })),
    )
  }

  const is_new_db = !was_resumed
  if (is_new_db) {
    await db.insert(db.schema.db_metadata).values([
      { key: 'db_id', value: db_id },
      { key: 'created_at', value: new Date().toISOString() },
    ])
  }

  console.info(`${db_id} PGlite instance created`)

  const live_db = create_live_pglite(pg as LivePGLite, { log: true })

  return { db, pg, was_resumed, live_db }
}

async function run_needed_migrations(pg: LivePGLite, was_resumed: boolean): Promise<string[] | null> {
  let existing_migration_names: string[] = []
  if (was_resumed) {
    const result = await pg.query<Migration>(`SELECT name FROM migrations`)
    existing_migration_names = result.rows.map(row => row.name)
  }

  const migrations = import.meta.glob(['./migrations/*.sql'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  const applied_migration_names: string[] = []
  for (const path in migrations) {
    const migration_name = path.split('/').pop()
    if (existing_migration_names.includes(migration_name!)) {
      console.info(`Skipping already applied migration: ${migration_name}`)
      continue
    }

    console.info(`Applying migration: ${migration_name}`)
    const sql = migrations[path]
    await pg.exec(sql)
    applied_migration_names.push(migration_name)
  }

  return applied_migration_names
}

// const METADATA_KEYS = {
//   DB_ID: 'db_id',
//   SYNCED_UP_TO: 'synced_up_to',
//   LAST_SYNCED_AT: 'last_synced_at',
// } as const
