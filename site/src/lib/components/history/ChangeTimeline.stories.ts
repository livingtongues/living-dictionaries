import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './ChangeTimeline.svelte'
import type { HistoryApiKey, HistoryChange, HistoryUser } from './types'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 720, height: 1000 }],
}

const users: Record<string, HistoryUser> = {
  u_ada: { id: 'u_ada', name: 'Ada Researcher', email: 'ada@example.org' },
  u_bo: { id: 'u_bo', name: null, email: 'bo@example.org' },
}

const api_keys: Record<string, HistoryApiKey> = {
  k_agent: { id: 'k_agent', label: 'Dictionary agent', created_by_user_id: 'u_ada' },
}

const changes: HistoryChange[] = [
  {
    id: 'c6',
    table_name: 'entries',
    row_id: 'e2',
    op: 'insert',
    user_id: 'u_ada',
    at: '2026-06-22T15:30:00.000Z',
    snapshot: { id: 'e2', lexeme: { en: 'river' } },
    delta: null,
    api_key_id: 'k_agent',
  },
  {
    id: 'c5',
    table_name: 'senses',
    row_id: 's1',
    op: 'delete',
    user_id: 'u_ada',
    at: '2026-06-22T15:04:00.000Z',
    snapshot: { id: 's1', glosses: { en: 'the liquid', es: 'el líquido' }, parts_of_speech: ['n'] },
    delta: null,
    api_key_id: null,
  },
  {
    id: 'c4',
    table_name: 'sentences',
    row_id: 'snt1',
    op: 'update',
    user_id: 'u_bo',
    at: '2026-06-22T14:30:00.000Z',
    snapshot: { id: 'snt1', text: { en: 'The water is very cold.' } },
    delta: { text: { old: { en: 'The water is cold.' }, new: { en: 'The water is very cold.' } } },
    api_key_id: null,
  },
  {
    id: 'c3',
    table_name: 'entries',
    row_id: 'e1',
    op: 'update',
    user_id: 'u_ada',
    at: '2026-06-22T14:05:00.000Z',
    snapshot: { id: 'e1', lexeme: { en: 'water' }, phonetic: 'ˈwɔːtər' },
    delta: { phonetic: { old: null, new: 'ˈwɔːtər' } },
    api_key_id: null,
  },
  {
    id: 'c2',
    table_name: 'senses',
    row_id: 's1',
    op: 'insert',
    user_id: 'u_ada',
    at: '2026-06-21T09:12:00.000Z',
    snapshot: { id: 's1', glosses: { en: 'the liquid' }, parts_of_speech: ['n'] },
    delta: null,
    api_key_id: null,
  },
  {
    id: 'c1',
    table_name: 'entries',
    row_id: 'e1',
    op: 'insert',
    user_id: 'u_ada',
    at: '2026-06-21T09:11:00.000Z',
    snapshot: { id: 'e1', lexeme: { en: 'water', es: 'agua' } },
    delta: null,
    api_key_id: null,
  },
]

export const EntryTimeline: PageStory<typeof Component> = {
  props: { changes, users, api_keys, has_more: true } as never,
}

export const SinglePage: PageStory<typeof Component> = {
  props: { changes: changes.slice(0, 3), users, api_keys, has_more: false } as never,
}

export const Empty: PageStory<typeof Component> = {
  props: { changes: [], users: {}, has_more: false, empty_label: 'No changes recorded for this entry yet.' } as never,
}

export const Loading: PageStory<typeof Component> = {
  props: { changes: [], users: {}, loading: true } as never,
}
