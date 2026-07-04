import { createRawSnippet } from 'svelte'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ModalEditableArray.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t: (key: string | { fallback?: string }) => typeof key === 'object' ? key.fallback || '' : key,
  },
}

const options = [
  { value: 'noun', name: 'noun' },
  { value: 'verb', name: 'verb' },
  { value: 'adjective', name: 'adjective' },
]

const heading_snippet = createRawSnippet(() => ({
  render: () => '<span>Select parts of speech</span>',
}))

export const Badges: Story<typeof Component> = {
  props: {
    values: ['noun'],
    options,
    placeholder: 'Select…',
    can_edit: true,
    on_update: () => {},
    heading: heading_snippet,
  },
}

export const ModalOpen: Story<typeof Component> = {
  csr: true,
  props: {
    values: ['noun'],
    options,
    placeholder: 'Select…',
    can_edit: true,
    on_update: () => {},
    heading: heading_snippet,
  },
  interactions: async (page) => {
    await page.click('.value-display')
    await page.waitForSelector('.modal-card')
    await new Promise(resolve => setTimeout(resolve, 350))
  },
}
