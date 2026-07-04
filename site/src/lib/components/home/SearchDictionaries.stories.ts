import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SearchDictionaries.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t: (key: string | { fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || ''
      return key === 'home.find_dictionary' ? 'Find a dictionary' : key
    },
  },
}

const dictionaries = [
  { id: 'd1', name: 'Achi', url: 'achi' },
  { id: 'd2', name: 'Birhor', url: 'birhor' },
  { id: 'd3', name: 'Chamacoco', url: 'chamacoco' },
] as any[]

export const ModalOpen: Story<typeof Component> = {
  csr: true,
  props: {
    dictionaries,
    setCurrentDictionary: () => {},
  },
  interactions: async (page) => {
    await page.click('button')
    await page.waitForSelector('.modal-card input')
    await new Promise(resolve => setTimeout(resolve, 350))
  },
}
