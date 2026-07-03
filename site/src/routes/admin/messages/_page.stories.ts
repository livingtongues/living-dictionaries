import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 600 }],
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

const threads = [
  {
    id: 'thread-1',
    subject: 'How do I add a new gloss language?',
    from_email: 'maria@example.com',
    from_name: 'Maria Lopez',
    to_email: 'support@livingdictionaries.app',
    last_message_at: '2026-05-29T10:00:00Z',
    replied_at: null,
    resolved_at: null,
    assigned_to_user_id: 'admin-1',
    _delete: async () => {},
  },
  {
    id: 'thread-2',
    subject: 'Audio upload not working',
    from_email: 'tomas@example.com',
    from_name: 'Tomás Núñez',
    to_email: 'support@livingdictionaries.app',
    last_message_at: '2026-05-28T08:30:00Z',
    replied_at: '2026-05-28T12:00:00Z',
    resolved_at: null,
    assigned_to_user_id: null,
    _delete: async () => {},
  },
]

const db = {
  message_threads: { ...make_table(threads, 'id'), query: () => ({ rows: threads, loading: false }) },
  users: make_table([
    { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin' },
  ], 'id'),
}

export const Inbox: PageStory<typeof Component> = {
  props: {
    auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', is_admin: true, admin_level: 3 }, token: 'fake', logout: () => {} },
    sync: null,
    db,
  } as never,
}
