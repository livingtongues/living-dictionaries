import { readable } from 'svelte/store'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  orthographies: [],
}

function entries_store(entries: Record<string, any>) {
  return Object.assign(readable(entries), { loading: readable(false) })
}

function media_connection(rows_by_table: Record<string, number>) {
  return {
    query: async (sql: string) => {
      const table = Object.keys(rows_by_table).find(name => sql.includes(`FROM ${name}`))
      if (!table) return []
      return Array.from({ length: rows_by_table[table] }, (_, index) => ({ storage_path: `demo/${table}/uuid-${index}.bin` }))
    },
  }
}

const populated = entries_store({
  e1: { id: 'e1', main: { lexeme: { default: 'atl' } }, senses: [{ glosses: { en: 'water' } }] },
  e2: { id: 'e2', main: { lexeme: { default: 'tletl' } }, senses: [{ glosses: { en: 'fire' } }] },
})

const shared_props = {
  dictionary,
  url_from_storage_path: (path: string) => `https://media.livingdictionaries.app/${path}`,
  auth_user: { is_admin: false },
} as never

export const ManagerWithMedia: PageStory<typeof Component> = {
  csr: true,
  props: {
    ...(shared_props as object),
    is_manager: true,
    entries_data: populated,
    connection: media_connection({ photos: 3, audio: 12, videos: 1 }),
  } as never,
}

export const ManagerWithoutMedia: PageStory<typeof Component> = {
  csr: true,
  props: {
    ...(shared_props as object),
    is_manager: true,
    entries_data: populated,
    connection: media_connection({}),
  } as never,
}

export const ManagerEmpty: PageStory<typeof Component> = {
  csr: true,
  props: {
    ...(shared_props as object),
    is_manager: true,
    entries_data: entries_store({}),
    connection: media_connection({}),
  } as never,
}

export const NotManager: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: false, entries_data: populated } as never,
}

export const AdminManager: PageStory<typeof Component> = {
  csr: true,
  props: {
    ...(shared_props as object),
    auth_user: { is_admin: true },
    is_manager: true,
    entries_data: populated,
    connection: media_connection({ photos: 3, audio: 12, videos: 1 }),
  } as never,
}
