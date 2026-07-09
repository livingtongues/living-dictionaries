import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1300, height: 640 }],
}

type Row = Record<string, unknown>

function make_table<T extends Row>(rows: T[], id_key = 'id') {
  return {
    rows,
    loading: false,
    objects: Object.fromEntries(rows.map(row => [row[id_key], row])),
    id: (key: string) => rows.find(row => row[id_key] === key),
    query: () => ({ rows, loading: false }),
  }
}

const dictionaries = [
  {
    id: 'dict-1',
    name: 'Nahuatl of Tlaxcala',
    public: 1,
    bucket: 'public',
    entry_count: 1842,
    iso_639_3: 'nhn',
    glottocode: 'cent2132',
    location: 'Tlaxcala, Mexico',
    coordinates: { points: [{ coordinates: { latitude: 19.318, longitude: -98.237 } }] },
    gloss_languages: ['es', 'en'],
    alternate_names: ['Mexicano', 'Aztec'],
    orthographies: [{ name: 'Modern' }],
    community_permission: 'Granted',
    language_used_by_community: 1,
    author_connection: 'Community linguist working with elders since 2019.',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2026-05-20T00:00:00Z',
  },
  {
    id: 'dict-2',
    name: 'Mixtec of Oaxaca',
    public: 1,
    bucket: 'public',
    entry_count: 530,
    iso_639_3: 'mig',
    glottocode: 'mixt1427',
    location: 'Oaxaca, Mexico',
    gloss_languages: ['es'],
    alternate_names: [],
    orthographies: [],
    created_at: '2025-03-02T00:00:00Z',
    updated_at: '2026-04-11T00:00:00Z',
  },
  {
    id: 'dict-3',
    name: 'Quechua Highlands',
    public: null,
    bucket: 'unlisted',
    entry_count: 12,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'dict-4',
    name: 'Esperanto Test Lexicon',
    public: null,
    bucket: 'conlang',
    con_language_description: 'Source: Invented for a novel.\n\nUse: A small hobbyist community.',
    entry_count: 88,
    created_at: '2025-11-20T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
]

const users = [
  { id: 'user-1', email: 'maria@example.com', name: 'Maria Lopez' },
  { id: 'user-2', email: 'tomas@example.com', name: 'Tomás Núñez' },
]

const roles = [
  { id: 'r1', dictionary_id: 'dict-1', user_id: 'user-1', role: 'manager' },
  { id: 'r2', dictionary_id: 'dict-1', user_id: 'user-2', role: 'contributor' },
  { id: 'r3', dictionary_id: 'dict-2', user_id: 'user-1', role: 'manager' },
]

const invites = [
  { id: 'i1', dictionary_id: 'dict-1', inviter_email: 'jwrunner7@gmail.com', target_email: 'new.editor@example.com', role: 'contributor', status: 'sent' },
]

const db = {
  dictionaries: { ...make_table(dictionaries, 'id'), query: () => ({ rows: dictionaries, loading: false }), update: async () => {} },
  dictionary_roles: { ...make_table(roles, 'id'), query: () => ({ rows: roles, loading: false }) },
  invites: { ...make_table(invites, 'id'), query: () => ({ rows: invites, loading: false }) },
  users: make_table(users, 'id'),
}

const shared_props = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 }, token: 'fake', logout: () => {} },
  sync: null,
  db,
} as never

export const Catalog: PageStory<typeof Component> = {
  props: shared_props,
}

export const AuthorConnectionModal: PageStory<typeof Component> = {
  props: shared_props,
  csr: true,
  interactions: async (page) => {
    await page.click('.clamp-btn')
  },
}

export const ConlangTab: PageStory<typeof Component> = {
  props: shared_props,
  csr: true,
  interactions: async (page) => {
    await page.click('button.filter-pill.conlang')
  },
}
