import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 700 }],
  params: { user_id: 'user-1' },
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
  { id: 'user-1', email: 'maria@example.com', name: 'Maria Lopez', unsubscribed_from_emails: null, last_visit_at: '2026-05-20T09:00:00Z', created_at: '2025-03-02T00:00:00Z', updated_at: '2026-05-20T09:00:00Z', _save: async () => {} },
]

const roles = [
  { id: 'r1', dictionary_id: 'dict-1', user_id: 'user-1', role: 'manager', created_at: '2025-03-02T00:00:00Z', _save: async () => {}, _delete: async () => {} },
  { id: 'r2', dictionary_id: 'dict-2', user_id: 'user-1', role: 'contributor', created_at: '2025-04-02T00:00:00Z', _save: async () => {}, _delete: async () => {} },
]

const dictionaries = [
  { id: 'dict-1', name: 'Nahuatl of Tlaxcala' },
  { id: 'dict-2', name: 'Mixtec of Oaxaca' },
]

const threads = [
  { id: 't1', from_user_id: 'user-1', subject: 'How do I add a gloss language?', last_message_at: '2026-05-29T10:00:00Z', replied_at: '2026-05-29T12:00:00Z', resolved_at: null },
]

const messages = [
  { id: 'm1', thread_id: 't1' },
  { id: 'm2', thread_id: 't1' },
]

const db = {
  users: { ...make_table(users, 'id'), id: (key: string) => users.find(user => user.id === key) },
  email_aliases: { ...make_table([] as Row[], 'email'), query: () => ({ rows: [], loading: false }) },
  dictionary_roles: { ...make_table(roles, 'id'), query: () => ({ rows: roles, loading: false }) },
  dictionaries: make_table(dictionaries, 'id'),
  message_threads: { ...make_table(threads, 'id'), query: () => ({ rows: threads, loading: false }) },
  messages: { ...make_table(messages, 'id'), query: () => ({ rows: messages, loading: false }) },
}

export const Detail: PageStory<typeof Component> = {
  props: {
    auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 2 }, token: 'fake', logout: () => {} },
    sync: null,
    db,
  } as never,
}
