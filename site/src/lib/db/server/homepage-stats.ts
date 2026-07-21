import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import type { HomepageStats } from '$lib/components/home-v2/types'
import { dictionary_db_path } from './dictionary-db'

/**
 * Platform-wide content stats for the homepage bake. The media counts require
 * opening every per-dict DB (~15s across ~2,200 dicts on the VPS), so the
 * result is cached for the process lifetime — the consumer is the build-time
 * bake fetch (once per deploy), not live traffic.
 */
let cached: HomepageStats | null = null
const MIN_UNLISTED_ENTRIES_FOR_HOMEPAGE = 6

export function compute_homepage_stats({ shared_db }: { shared_db: BetterSqlite3.Database }): HomepageStats {
  if (cached)
    return cached

  // Cube number: every publicly listed dictionary plus established unlisted
  // projects. Small unlisted shells are covered by the trailing "+".
  const dictionaries = (shared_db.prepare(
    `SELECT COUNT(*) AS count
     FROM dictionaries
     WHERE public = 1 OR (bucket = 'unlisted' AND entry_count >= ?)`,
  ).get(MIN_UNLISTED_ENTRIES_FOR_HOMEPAGE) as { count: number }).count
  const public_dictionaries = (shared_db.prepare(
    'SELECT COUNT(*) AS count FROM dictionaries WHERE public = 1',
  ).get() as { count: number }).count
  const entries = (shared_db.prepare('SELECT COALESCE(SUM(entry_count), 0) AS sum FROM dictionaries').get() as { sum: number }).sum
  const users = (shared_db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count

  let audio = 0
  let photos = 0
  let videos = 0
  const dict_ids = (shared_db.prepare('SELECT id FROM dictionaries').all() as { id: string }[]).map(row => row.id)
  for (const dict_id of dict_ids) {
    const path = dictionary_db_path(dict_id)
    if (!existsSync(path))
      continue
    try {
      const dict_db = new Database(path, { readonly: true })
      try {
        audio += (dict_db.prepare('SELECT COUNT(*) AS count FROM audio').get() as { count: number }).count
        photos += (dict_db.prepare('SELECT COUNT(*) AS count FROM photos').get() as { count: number }).count
        videos += (dict_db.prepare('SELECT COUNT(*) AS count FROM videos').get() as { count: number }).count
      } finally {
        dict_db.close()
      }
    } catch {
      // unopenable/corrupt file → skip; stats are approximate by design
    }
  }

  cached = { dictionaries, public_dictionaries, entries, audio, photos, videos, users }
  return cached
}

export function reset_homepage_stats_cache() {
  cached = null
}
