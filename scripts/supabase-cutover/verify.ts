import type Database from 'better-sqlite3'
import type { PoolClient } from 'pg'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { postgres } from '../config-supabase'
import { read_dictionaries } from './read'

/**
 * Verify a migration run: per-table COUNT parity (Supabase vs SQLite) for each
 * migrated dictionary. Run AFTER migrate.ts. Read-only on both sides.
 *
 *   tsx supabase-cutover/verify.ts -e prod [--dict-id X] [--limit N] [--data-dir DIR]
 */

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = resolve(here, '../../../site/.data')

function get_flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'))
    return process.argv[index + 1]
  return fallback
}

const CONTENT_TABLES = [
  'entries', 'texts', 'sentences', 'senses', 'senses_in_sentences', 'speakers',
  'audio', 'audio_speakers', 'videos', 'video_speakers', 'sense_videos',
  'sentence_videos', 'photos', 'sense_photos', 'sentence_photos', 'dialects',
  'entry_dialects', 'tags', 'entry_tags',
]

async function count_pg(client: PoolClient, table: string, dict_id: string): Promise<number> {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE dictionary_id = $1`, [dict_id])
  return Number(result.rows[0]?.count ?? 0)
}

function count_sqlite(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
}

async function main() {
  const data_dir = get_flag('--data-dir', DEFAULT_DATA_DIR)!
  const dict_id = get_flag('--dict-id')
  const limit_raw = get_flag('--limit')
  const limit = limit_raw ? Number(limit_raw) : undefined

  const client = await postgres.get_db_connection()
  let total_mismatches = 0
  try {
    const dicts = await read_dictionaries(client, { dict_id, limit })
    for (const dict of dicts) {
      const db_path = join(data_dir, 'dictionaries', `${dict.id}.db`)
      const db = new BetterSqlite3(db_path, { readonly: true })
      const mismatches: string[] = []
      for (const table of CONTENT_TABLES) {
        const pg = await count_pg(client, table, dict.id)
        const sqlite = count_sqlite(db, table)
        if (pg !== sqlite)
          mismatches.push(`${table}: pg=${pg} sqlite=${sqlite}`)
      }
      db.close()
      if (mismatches.length) {
        total_mismatches += mismatches.length
        console.error(`✗ ${dict.id} — "${dict.name}"`)
        for (const mismatch of mismatches)
          console.error(`    ${mismatch}`)
      } else {
        console.info(`✓ ${dict.id} — "${dict.name}" — all ${CONTENT_TABLES.length} tables match`)
      }
    }
    console.info(`\n${total_mismatches === 0 ? '✓ All dictionaries match' : `✗ ${total_mismatches} table mismatches`}`)
  } finally {
    client.release()
  }
  process.exit(total_mismatches === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
