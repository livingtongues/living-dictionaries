import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 720 }],
}

type Row = Record<string, unknown>

function make_table<T extends Row>(rows: T[]) {
  return {
    rows,
    loading: false,
    objects: Object.fromEntries(rows.map(row => [row.id, row])),
    id: (key: string) => rows.find(row => row.id === key),
    query: () => ({ rows, loading: false }),
  }
}

const dictionaries = [
  {
    id: 'nahuatl',
    url: 'nahuatl',
    name: 'Nahuatl of Tlaxcala',
    public: 1,
    bucket: 'public',
    entry_count: 1842,
    iso_639_3: 'nhn',
    glottocode: 'cent2132',
    location: 'Tlaxcala, Mexico',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2026-05-20T00:00:00Z',
  },
  {
    id: 'ancient-aramaic',
    url: 'ancient-aramaic',
    name: 'Ancient Aramaic',
    public: null,
    bucket: 'unlisted',
    entry_count: 431,
    iso_639_3: 'oar',
    location: 'Ancient Syria',
    author_connection: 'I am not part of the ancient Aramaic community but Living Tongues is in contact with language activists.',
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2024-04-20T00:00:00Z',
  },
  {
    id: 'aetherscript',
    url: 'aetherscript',
    name: 'Aetherscript',
    public: null,
    bucket: 'conlang',
    entry_count: 812,
    con_language_description: 'Source: I made it all up myself for my fantasy novel. Use: Just me and my readers.',
    created_at: '2025-11-20T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'unit-3-airports',
    url: 'unit-3-airports',
    name: 'UNIT 3. AIRPORTS',
    public: null,
    bucket: 'glossary',
    entry_count: 268,
    con_language_description: 'An English dictionary of aircraft terminology designed for translators at a C1 level.',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
  },
  {
    id: 'abandoned-test',
    url: 'abandoned-test',
    name: 'My Test Dictionary',
    public: null,
    bucket: 'delete',
    entry_count: 2,
    created_at: '2022-03-01T00:00:00Z',
    updated_at: '2023-03-01T00:00:00Z',
  },
  {
    id: 'jeju',
    url: 'jeju',
    name: 'Jeju',
    public: null,
    bucket: null,
    entry_count: 0,
    author_connection: 'I am a native of Jeju island, where we speak the Jeju language. This language is endangered.',
    created_at: '2026-06-20T00:00:00Z',
    updated_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 'mismatched',
    url: 'mismatched',
    name: 'Mismatched Conlang (listed)',
    public: 1,
    bucket: 'conlang',
    entry_count: 55,
    con_language_description: 'Source: my imagination. Use: my imaginary friends.',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

const roles = [
  { id: 'r1', dictionary_id: 'nahuatl', user_id: 'user-1', role: 'manager' },
  { id: 'r2', dictionary_id: 'nahuatl', user_id: 'user-2', role: 'contributor' },
  { id: 'r3', dictionary_id: 'jeju', user_id: 'user-1', role: 'manager' },
]

const db = {
  dictionaries: { ...make_table(dictionaries), update: async () => {} },
  dictionary_roles: make_table(roles),
}

const shared_props = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 }, token: 'fake', logout: () => {} },
  sync: null,
  db,
} as never

export const Unclassified: PageStory<typeof Component> = {
  props: shared_props,
}

export const DeleteQueue: PageStory<typeof Component> = {
  props: shared_props,
  page_data: {},
  csr: true,
  interactions: async (page) => {
    await page.click('button.filter-pill.delete')
  },
}

export const Mismatch: PageStory<typeof Component> = {
  props: shared_props,
  csr: true,
  interactions: async (page) => {
    await page.click('button.filter-pill.mismatch')
  },
}
