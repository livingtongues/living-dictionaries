import { open_test_shared_db } from '$lib/db/server/shared-db'
import { load } from './+layout.server'

let shared_db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async original => ({
  ...(await original<typeof import('$lib/db/server/shared-db')>()),
  get_shared_db: () => shared_db,
}))

beforeEach(() => {
  shared_db = open_test_shared_db()
  const insert = shared_db.prepare(`
    INSERT INTO dictionaries (id, url, name, bucket, gloss_languages, entry_count, public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insert.run('legacy-id', 'current-slug', 'Public Dictionary', null, JSON.stringify(['en']), 0, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  insert.run('secure-id', 'secure-slug', 'Secure Dictionary', 'secure', JSON.stringify(['en']), 0, null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
})

afterEach(() => shared_db.close())

function load_dictionary({ dictionary_id, path = `/${dictionary_id}`, ssr_user = null }: {
  dictionary_id: string
  path?: string
  ssr_user?: { id: string, admin_level: number } | null
}) {
  const url = new URL(path, 'https://livingdictionaries.app')
  return load({
    params: { dictionaryId: dictionary_id },
    parent: () => Promise.resolve({ ssr_user }),
    url,
    depends: vi.fn(),
  } as never)
}

describe(load, () => {
  test('returns 404 for an unresolved slug', async () => {
    await expect(load_dictionary({ dictionary_id: 'missing' })).rejects.toMatchObject({
      status: 404,
      body: { message: 'Not found' },
    })
  })

  test('gives a blocked secure dictionary the same 404 response', async () => {
    await expect(load_dictionary({ dictionary_id: 'secure-slug' })).rejects.toMatchObject({
      status: 404,
      body: { message: 'Not found' },
    })
  })

  test('preserves a known legacy-id canonical redirect with path and query', async () => {
    await expect(load_dictionary({
      dictionary_id: 'legacy-id',
      path: '/legacy-id/about?ref=old',
    })).rejects.toMatchObject({
      status: 301,
      location: '/current-slug/about?ref=old',
    })
  })

  test('loads a known canonical slug normally', async () => {
    const result = await load_dictionary({ dictionary_id: 'current-slug' })
    expect(result).toMatchObject({
      dictionary: { id: 'legacy-id', url: 'current-slug' },
      about_is_complete: false,
    })
  })
})
