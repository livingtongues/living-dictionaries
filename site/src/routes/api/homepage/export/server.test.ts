import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { reset_homepage_stats_cache } from '$lib/db/server/homepage-stats'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET } from './+server'

let db: ReturnType<typeof open_test_shared_db>

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
  db = open_test_shared_db()
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
    expect(body.stats).toEqual({ dictionaries: 2, public_dictionaries: 2, entries: 200, audio: 0, photos: 0, videos: 0, users: 2 })
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

  test('dictionaries stat = public + unlisted; public_dictionaries = public only', async () => {
    const now = '2026-07-01T00:00:00.000Z'
    // unlisted bucket (public col 0) counts toward the cube but not the footer number
    db.prepare(`INSERT INTO dictionaries (id, url, name, public, bucket, entry_count, created_at, updated_at) VALUES ('sora', 'sora', 'Sora', 0, 'unlisted', 50, ?, ?)`).run(now, now)
    // a conlang bucket counts toward neither
    db.prepare(`INSERT INTO dictionaries (id, url, name, public, bucket, entry_count, created_at, updated_at) VALUES ('klingon', 'klingon', 'Klingon', 0, 'conlang', 999, ?, ?)`).run(now, now)
    reset_homepage_stats_cache()

    const response = await GET({ request: new Request('http://localhost/api/homepage/export') } as Parameters<typeof GET>[0])
    const body = await response.json()
    expect(body.stats.dictionaries).toBe(3) // 2 public + 1 unlisted
    expect(body.stats.public_dictionaries).toBe(2)
  })

  test('modal snapshot fields ride along (JSON columns parsed, catalog location joined)', async () => {
    db.prepare(`
      UPDATE featured_entries SET
        phonetic = 'tsʼi.kin',
        glosses = ?,
        speaker_name = 'Manuel',
        example_sentence = ?
      WHERE id = 'fe1'`).run(
      JSON.stringify({ en: 'bird', es: 'pájaro' }),
      JSON.stringify({ text: { default: 'Tzʼikin chikop' }, translation: { en: 'The bird flies' } }),
    )
    db.prepare(`UPDATE dictionaries SET location = 'Guatemala' WHERE id = 'achi'`).run()

    const response = await GET({ request: new Request('http://localhost/api/homepage/export') } as Parameters<typeof GET>[0])
    const body = await response.json()
    expect(body.featured_entries[0]).toMatchObject({
      phonetic: 'tsʼi.kin',
      glosses: { en: 'bird', es: 'pájaro' },
      speaker_name: 'Manuel',
      example_sentence: { text: { default: 'Tzʼikin chikop' }, translation: { en: 'The bird flies' } },
      dict_location: 'Guatemala',
    })
  })
})
