import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Progress.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 360, height: 90 }],
  page_data: { t: mock_t },
}

export const Half: Story<typeof Component> = {
  csr: true,
  props: { progress: 0.5 },
  interactions: async (page) => {
    await new Promise(resolve => setTimeout(resolve, 2200))
  },
}

export const Complete: Story<typeof Component> = {
  csr: true,
  props: { progress: 1 },
  interactions: async (page) => {
    await new Promise(resolve => setTimeout(resolve, 2200))
  },
}
