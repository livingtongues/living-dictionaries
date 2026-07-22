import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { translate_store } from '$lib/translate/translate-store.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 600 }],
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

const users = [
  { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', roles: null, unsubscribed_from_emails: null, last_visit_at: '2026-05-29T09:00:00Z', created_at: '2024-01-15T00:00:00Z', updated_at: '2026-05-29T09:00:00Z' },
  { id: 'user-1', email: 'maria@example.com', name: 'Maria Lopez', roles: ['super_manager'], unsubscribed_from_emails: null, last_visit_at: '2026-05-20T09:00:00Z', created_at: '2025-03-02T00:00:00Z', updated_at: '2026-05-20T09:00:00Z' },
  { id: 'user-2', email: 'tomas@example.com', name: 'Tomás Núñez', roles: null, unsubscribed_from_emails: '2026-04-01T00:00:00Z', last_visit_at: '2026-02-10T09:00:00Z', created_at: '2025-06-20T00:00:00Z', updated_at: '2026-02-10T09:00:00Z' },
]

translate_store.summary = {
  locales: [],
  translators: [
    { user_id: 'user-1', name: 'Maria Lopez', email: 'maria@example.com', locales: ['es', 'fr'] },
  ],
}

const dictionaries = [
  { id: 'dict-1', name: 'Kalanga' },
  { id: 'dict-2', name: 'Tira' },
  { id: 'dict-3', name: 'Gourmanché' },
]

const roles = [
  { id: 'r1', dictionary_id: 'dict-1', user_id: 'user-1', role: 'manager' },
  { id: 'r2', dictionary_id: 'dict-2', user_id: 'user-1', role: 'contributor' },
  { id: 'r3', dictionary_id: 'dict-1', user_id: 'user-2', role: 'contributor' },
]

const threads = [
  { id: 't1', from_user_id: 'user-1', last_message_at: '2026-05-29T10:00:00Z' },
]

const db = {
  users: { ...make_table(users, 'id'), query: () => ({ rows: users, loading: false }) },
  email_aliases: { ...make_table([] as Row[], 'email'), query: () => ({ rows: [], loading: false }) },
  message_threads: { ...make_table(threads, 'id'), query: () => ({ rows: threads, loading: false }) },
  dictionary_roles: { ...make_table(roles, 'id'), query: () => ({ rows: roles, loading: false }) },
  dictionaries: make_table(dictionaries, 'id'),
}

export const List: PageStory<typeof Component> = {
  props: {
    auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 }, token: 'fake', logout: () => {} },
    sync: null,
    db,
  } as never,
}

const first_names = ['Maria', 'Tomás', 'Amara', 'Wei', 'Fatima', 'Diego', 'Ingrid', 'Kofi', 'Sanjay', 'Lena', 'Olu', 'Priya', 'Hassan', 'Yuki', 'Nadia', 'Pablo']
const last_names = ['Lopez', 'Núñez', 'Okafor', 'Chen', 'Al-Sayed', 'Rivera', 'Bergström', 'Mensah', 'Patel', 'Novak', 'Adeyemi', 'Rao', 'Karim', 'Tanaka', 'Haddad', 'Ortega']
const many_users = Array.from({ length: 260 }, (_, i) => {
  const name = `${first_names[i % first_names.length]} ${last_names[(i * 7) % last_names.length]}`
  const day = String((i % 27) + 1).padStart(2, '0')
  return {
    id: `u-${i}`,
    email: `user${i}@example.com`,
    name,
    roles: i % 40 === 0 ? ['super_manager'] : null,
    unsubscribed_from_emails: i % 13 === 0 ? '2026-04-01T00:00:00Z' : null,
    last_visit_at: `2026-05-${day}T09:00:00Z`,
    created_at: `2024-06-${day}T00:00:00Z`,
    updated_at: `2026-05-${day}T09:00:00Z`,
  }
})
const many_db = {
  users: { ...make_table(many_users, 'id'), query: () => ({ rows: many_users, loading: false }) },
  email_aliases: { ...make_table([] as Row[], 'email'), query: () => ({ rows: [], loading: false }) },
  message_threads: { ...make_table([] as Row[], 'id'), query: () => ({ rows: [], loading: false }) },
  dictionary_roles: { ...make_table([] as Row[], 'id'), query: () => ({ rows: [], loading: false }) },
  dictionaries: make_table(dictionaries, 'id'),
}

const many_props = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 }, token: 'fake', logout: () => {} },
  sync: null,
  db: many_db,
} as never

export const Paginated: PageStory<typeof Component> = {
  props: many_props,
}

export const PaginatedPage2: PageStory<typeof Component> = {
  props: many_props,
  csr: true,
  interactions: async (page) => {
    await page.click('.pagination .controls .page-btn:nth-child(3)')
  },
}
