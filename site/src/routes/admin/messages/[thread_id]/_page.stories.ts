import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 700 }],
  params: { thread_id: 'thread-1' },
  csr: true,
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

const thread = {
  id: 'thread-1',
  subject: 'How do I add a new gloss language?',
  source: 'contact_form',
  from_user_id: 'user-demo',
  from_email: 'maria@example.com',
  from_name: 'Maria Lopez',
  to_email: null,
  url: 'https://livingdictionaries.app/some-dictionary',
  last_message_at: '2026-05-29T10:00:00Z',
  read_at: '2026-05-29T11:00:00Z',
  replied_at: null,
  replied_by_user_id: null,
  resolved_at: null,
  resolved_by_user_id: null,
  assigned_to_user_id: 'admin-1',
  _save: async () => {},
  _delete: async () => {},
}

const messages = [
  {
    id: 'msg-1',
    thread_id: 'thread-1',
    author_user_id: 'user-demo',
    author_kind: 'customer',
    body_text: 'Hi! I run a community dictionary and would love to add Spanish as a second gloss language. How do I do that?',
    body_html: null,
    sent_at: '2026-05-29T10:00:00Z',
    delivery_status: null,
    delivery_error: null,
    created_at: '2026-05-29T10:00:00Z',
  },
  {
    id: 'msg-2',
    thread_id: 'thread-1',
    author_user_id: 'admin-1',
    author_kind: 'admin',
    body_text: 'Great question! Head to your dictionary settings and add the language under "Gloss languages".',
    body_html: null,
    sent_at: '2026-05-29T12:00:00Z',
    delivery_status: 'sent',
    delivery_error: null,
    created_at: '2026-05-29T12:00:00Z',
  },
]

const db = {
  message_threads: make_table([thread], 'id'),
  messages: make_table(messages, 'id'),
  message_attachments: make_table([] as Row[], 'id'),
  users: make_table([
    { id: 'user-demo', email: 'maria@example.com', name: 'Maria Lopez' },
    { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin' },
  ], 'id'),
}

const base_props = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 2 }, token: 'fake', logout: () => {} },
  sync: null,
  db,
}

export const Thread: PageStory<typeof Component> = {
  props: base_props as never,
}
