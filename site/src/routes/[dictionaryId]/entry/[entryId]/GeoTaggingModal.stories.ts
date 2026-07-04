import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GeoTaggingModal.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'create.select_coordinates': 'Select coordinates',
    'create.select_region': 'Select region',
    'misc.close': 'Close',
    'map.webgl_unavailable': 'Map unavailable (WebGL is disabled or unsupported in this browser).',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: { t },
  csr: true,
}

export const WithPoint: Story<typeof Component> = {
  props: {
    coordinates: { points: [{ coordinates: { longitude: -71.5, latitude: -16.4 } }], regions: [] },
    initialCenter: { longitude: -71.5, latitude: -16.4 },
    on_update: async () => {},
    on_close: () => {},
  },
  interactions: async (page) => {
    await page.waitForSelector('.modal-card')
    await new Promise(resolve => setTimeout(resolve, 2500))
  },
}
