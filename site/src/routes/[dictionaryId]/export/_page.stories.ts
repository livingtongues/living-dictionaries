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

const populated = entries_store({
  e1: { id: 'e1', main: { lexeme: { default: 'atl' } }, senses: [{ glosses: { en: 'water' }, photos: [{ storage_path: 'images/a.jpg' }] }] },
  e2: { id: 'e2', main: { lexeme: { default: 'tletl' } }, senses: [{ glosses: { en: 'fire' } }], audios: [{ storage_path: 'audio/b.mp3' }] },
  e3: { id: 'e3', main: { lexeme: { default: 'tepetl' } }, senses: [{ glosses: { en: 'mountain' } }] },
})

const shared_props = {
  dictionary,
  url_from_storage_path: (path: string) => `https://lh3.example/${path}`,
  auth_user: { is_admin: false },
} as never

export const ManagerWithMedia: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: true, entries_data: populated } as never,
}

export const ManagerEmpty: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: true, entries_data: entries_store({}) } as never,
}

export const NotManager: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: false, entries_data: populated } as never,
}

export const ManagerImagesSelected: PageStory<typeof Component> = {
  csr: true,
  props: { ...(shared_props as object), is_manager: true, entries_data: populated } as never,
  interactions: async (page) => {
    await page.waitForSelector('#images')
    await page.click('#images')
  },
}
