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

// Regression: several distinct values that resolve to the SAME display name
// (e.g. three custom tags all named "above"). The chips `{#each}` must key by
// the unique `value`, not `name`, or Svelte throws `each_key_duplicate` and the
// field freezes showing raw ids. See Diego's sugtstun bug.
export const DuplicateNames: Story<typeof Component> = {
  props: {
    values: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
    options: [
      { value: 'tag-1', name: 'above' },
      { value: 'tag-2', name: 'above' },
      { value: 'tag-3', name: 'above' },
      { value: 'tag-4', name: 'Millie' },
    ],
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
