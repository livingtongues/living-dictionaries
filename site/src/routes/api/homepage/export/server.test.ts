import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { reset_homepage_stats_cache } from '$lib/db/server/homepage-stats'
import { open_shared_db } from '$lib/db/server/shared-db'
import { GET } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

// keep the per-dict media scan away from the real .data fixtures
vi.mock('$lib/db/server/dictionary-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/dictionary-db')>('$lib/db/server/dictionary-db')
  return { ...actual, dictionary_db_path: (dict_id: string) => `/nonexistent-test-dir/${dict_id}.db` }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  reset_homepage_stats_cache()
  db = open_shared_db(':memory:')
  const now = '2026-07-01T00:00:00.000Z'
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES ('u1', 'a@b.com', 'A', '[]', ?, ?)`).run(now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, public, entry_count, created_at, updated_at) VALUES ('achi', 'achi', 'Achi', 1, 120, ?, ?)`).run(now, now)
  db.prepare(`INSERT INTO dictionaries (id, url, name, public, entry_count, created_at, updated_at) VALUES ('gta', 'gta-slug', 'GtaɁ', 1, 80, ?, ?)`).run(now, now)
  const insert = db.prepare(`
    INSERT INTO featured_entries (id, dict_id, entry_id, lexeme, gloss, gloss_language, photo_serving_url, audio_storage_path, dict_name, longitude, latitude, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  insert.run('fe1', 'achi', 'e1', 'tz’ikin', 'bird', 'en', 'hash1', 'achi/audio/1.mp3', 'Achi', -90.4, 15.1, 'approved')
  insert.run('fe2', 'gta', 'e2', 'gsoʔ', 'water', 'es', 'hash2', 'gta/audio/2.mp3', 'GtaɁ', 84.1, 19.2, 'suggested')
})

afterEach(() => {
  db.close()
})

describe(GET, () => {
  test('public payload: stats + only approved cards with live url slug', async () => {
    const response = await GET({ request: new Request('http://localhost/api/homepage/export') } as Parameters<typeof GET>[0])
    expect(response.status).toBe(200)
    const body = await response.json()
    // users: 2 = the seeded agent@livingdictionaries.app row (initial migration) + u1
    expect(body.stats).toEqual({ dictionaries: 2, entries: 200, audio: 0, photos: 0, videos: 0, users: 2 })
    expect(body.featured_entries).toHaveLength(1)
    expect(body.featured_entries[0]).toMatchObject({
      id: 'fe1',
      dict_url: 'achi',
      lexeme: 'tz’ikin',
      gloss: 'bird',
      lng: -90.4,
      lat: 15.1,
    })
    expect(typeof body.generated_at).toBe('string')
  })
})
