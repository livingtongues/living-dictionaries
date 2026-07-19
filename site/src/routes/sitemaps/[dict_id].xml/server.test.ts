import { open_test_shared_db } from '$lib/db/server/shared-db'
import { MINIMUM_ABOUT_LENGTH } from '$lib/constants'
import { GET } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async original => ({
  ...(await original<typeof import('$lib/db/server/shared-db')>()),
  get_shared_db: () => shared_db,
}))

vi.mock('$lib/db/server/dictionary-db', () => ({
  dictionary_db_path: () => '/dev/null/missing-dictionary.db',
  get_dictionary_db: vi.fn(),
}))

beforeEach(() => {
  shared_db = open_test_shared_db()
  shared_db.prepare(`
    INSERT INTO dictionaries (id, url, name, about, gloss_languages, entry_count, public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'dict-1',
    'my-dictionary',
    'My Dictionary',
    'a'.repeat(MINIMUM_ABOUT_LENGTH),
    JSON.stringify(['en']),
    0,
    1,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z',
  )
})

afterEach(() => shared_db.close())

function get_sitemap() {
  return GET({
    params: { dict_id: 'dict-1' },
    url: new URL('https://livingdictionaries.app/sitemaps/dict-1.xml'),
  } as never) as Response
}

describe(GET, () => {
  test('includes About only when it meets the rendered-text threshold', async () => {
    const complete_xml = await (await get_sitemap()).text()
    expect(complete_xml).toContain('<loc>https://livingdictionaries.app/my-dictionary/about</loc>')

    const thin_link = `[x](https://example.com/${'path/'.repeat(50)})`
    shared_db.prepare('UPDATE dictionaries SET about = ? WHERE id = ?').run(thin_link, 'dict-1')

    const thin_xml = await (await get_sitemap()).text()
    expect(thin_xml).not.toContain('/my-dictionary/about</loc>')
    expect(thin_xml).toContain('/my-dictionary/entries</loc>')
  })
})
