import type { Story, StoryMeta } from 'svelte-look'
import type Component from './RegionModal.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'create.select_region': 'Select region',
    'about.search': 'Search',
    'misc.cancel': 'Cancel',
    'misc.remove': 'Remove',
    'misc.save': 'Save',
    'map.webgl_unavailable': 'Map unavailable (WebGL is disabled or unsupported in this browser).',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: { t },
  csr: true,
}

export const WithRegion: Story<typeof Component> = {
  props: {
    region: {
      coordinates: [
        { longitude: -71.5, latitude: -16.4 },
        { longitude: -71.2, latitude: -16.6 },
        { longitude: -71.7, latitude: -16.7 },
      ],
    } as any,
    on_update: () => {},
    on_remove: () => {},
    on_close: () => {},
  },
  interactions: async (page) => {
    await page.waitForSelector('.modal-card')
    await new Promise(resolve => setTimeout(resolve, 2500))
  },
}
