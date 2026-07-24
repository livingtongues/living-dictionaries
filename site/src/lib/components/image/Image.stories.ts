import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Image.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 800, height: 560 }],
  csr: true,
  page_data: {
    t: (key: string | { fallback?: string }) => typeof key === 'object' ? key.fallback || '' : key,
  },
}

const noop = (() => {}) as never
// Empty serving_url resolves to the bundled dev placeholder, so the fullscreen
// preload succeeds and the viewer (where the credit footer lives) opens.
const photo = { serving_url: '' } as never

const base = {
  title: 'tz’ikin',
  photo,
  photo_source: 'Photographed during the 2023 community documentation workshop.',
  photographer: 'Ana Lopez',
  on_delete_image: noop,
}

export const Viewer: Story<typeof Component> = {
  props: { ...base, can_edit: true },
  interactions: async (page) => {
    await page.click('.thumb')
    await page.waitForSelector('.viewer-footer')
  },
}
