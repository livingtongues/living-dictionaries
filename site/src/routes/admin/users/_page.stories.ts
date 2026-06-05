import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

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
  { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', unsubscribed_from_emails: null, last_visit_at: '2026-05-29T09:00:00Z', created_at: '2024-01-15T00:00:00Z', updated_at: '2026-05-29T09:00:00Z' },
  { id: 'user-1', email: 'maria@example.com', name: 'Maria Lopez', unsubscribed_from_emails: null, last_visit_at: '2026-05-20T09:00:00Z', created_at: '2025-03-02T00:00:00Z', updated_at: '2026-05-20T09:00:00Z' },
  { id: 'user-2', email: 'tomas@example.com', name: 'Tomás Núñez', unsubscribed_from_emails: '2026-04-01T00:00:00Z', last_visit_at: '2026-02-10T09:00:00Z', created_at: '2025-06-20T00:00:00Z', updated_at: '2026-02-10T09:00:00Z' },
]

const roles = [
  { id: 'r1', dictionary_id: 'dict-1', user_id: 'user-1', role: 'manager' },
  { id: 'r2', dictionary_id: 'dict-2', user_id: 'user-1', role: 'contributor' },
  { id: 'r3', dictionary_id: 'dict-1', user_id: 'user-2', role: 'editor' },
]

const threads = [
  { id: 't1', from_user_id: 'user-1', last_message_at: '2026-05-29T10:00:00Z' },
]

const db = {
  users: { ...make_table(users, 'id'), query: () => ({ rows: users, loading: false }) },
  email_aliases: { ...make_table([] as Row[], 'email'), query: () => ({ rows: [], loading: false }) },
  message_threads: { ...make_table(threads, 'id'), query: () => ({ rows: threads, loading: false }) },
  dictionary_roles: { ...make_table(roles, 'id'), query: () => ({ rows: roles, loading: false }) },
}

export const List: PageStory<typeof Component> = {
  props: {
    auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 2 }, token: 'fake', logout: () => {} },
    sync: null,
    db,
  } as never,
}
