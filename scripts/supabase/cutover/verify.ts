import type { PoolClient } from 'pg'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { postgres } from '../config-supabase'

/**
 * Verify a migration run: per-table COUNT parity (Supabase vs SQLite) for every
 * dict recorded in the run manifest. Read-only on both sides.
 *
 * - pg side: ONE `GROUP BY dictionary_id` query per table (19 total — not
 *   19 × N dicts like the first version).
 * - Rows the migration legitimately SYNTHESIZES (audio-source resolution →
 *   new speakers / audio_speakers links) are read from the manifest and added
 *   to the pg expectation.
 *
 *   tsx supabase-cutover/verify.ts -e prod [--data-dir DIR] [--dict-id X]
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

/** Live rows only — tombstoned Supabase rows are not migrated (hard-delete model). */
async function read_pg_counts(client: PoolClient, table: string): Promise<Map<string, number>> {
  const result = await client.query(`SELECT dictionary_id, COUNT(*)::int AS count FROM ${table} WHERE deleted IS NULL GROUP BY dictionary_id`)
  return new Map(result.rows.map((row: { dictionary_id: string, count: number }) => [row.dictionary_id, Number(row.count)]))
}

async function main() {
  const data_dir = get_flag('--data-dir', DEFAULT_DATA_DIR)!
  const only_dict = get_flag('--dict-id')

  const manifest_page = join(data_dir, 'migration-manifest.json')
  if (!existsSync(manifest_page)) {
    console.error(`No migration-manifest.json in ${data_dir} — run migrate.ts first.`)
    process.exitCode = 1
    return
  }
  const manifest = JSON.parse(readFileSync(manifest_page, 'utf8')) as {
    dicts: Record<string, {
      synthesized: { speakers: number, audio_speakers: number, sources: number }
      pruned?: Record<string, number>
    }>
  }
  const dict_ids = Object.keys(manifest.dicts).filter(id => !only_dict || id === only_dict)

  const client = await postgres.get_db_connection()
  let total_mismatches = 0
  let checked = 0
  try {
    const pg_counts = new Map<string, Map<string, number>>()
    for (const table of CONTENT_TABLES)
      pg_counts.set(table, await read_pg_counts(client, table))

    for (const dict_id of dict_ids) {
      const db_path = join(data_dir, 'dictionaries', `${dict_id}.db`)
      if (!existsSync(db_path)) {
        console.error(`✗ ${dict_id} — missing db file`)
        total_mismatches++
        continue
      }
      const db = new BetterSqlite3(db_path, { readonly: true })
      const { synthesized, pruned = {} } = manifest.dicts[dict_id]
      const mismatches: string[] = []
      for (const table of CONTENT_TABLES) {
        let expected = pg_counts.get(table)!.get(dict_id) ?? 0
        if (table === 'speakers')
          expected += synthesized.speakers
        if (table === 'audio_speakers')
          expected += synthesized.audio_speakers
        expected -= pruned[table] ?? 0
        const actual = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
        if (expected !== actual)
          mismatches.push(`${table}: expected ${expected} (pg live ± synthesized/pruned) got ${actual}`)
      }
      db.close()
      checked++
      if (mismatches.length) {
        total_mismatches += mismatches.length
        console.error(`✗ ${dict_id}`)
        for (const mismatch of mismatches)
          console.error(`    ${mismatch}`)
      }
    }

    // console.log, NOT console.info — record-logs.ts (imported via config-supabase) hijacks info to file-only
    console.log(`\nchecked ${checked}/${dict_ids.length} dicts — ${total_mismatches === 0 ? '✓ all counts match' : `✗ ${total_mismatches} table mismatches`}`)
  } finally {
    client.release()
    await postgres.end()
  }
  process.exitCode = total_mismatches === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
