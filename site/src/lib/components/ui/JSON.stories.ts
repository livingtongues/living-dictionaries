import type { Story, StoryMeta } from 'svelte-look'
import type Component from './JSON.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 240 }],
}

const obj = { id: 'abc123', count: 42, active: true, missing: null, nested: { name: 'Example' } }

export const Closed: Story<typeof Component> = {
  props: { obj },
}

export const Open: Story<typeof Component> = {
  props: { obj },
  csr: true,
  interactions: async (page) => {
    await page.click('button')
    await new Promise(resolve => setTimeout(resolve, 200))
  },
}
