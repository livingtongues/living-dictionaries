import type { Story, StoryMeta } from 'svelte-look'
import type Component from './CoordinatesModal.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'create.select_coordinates': 'Select coordinates',
    'dictionary.latitude': 'Latitude',
    'dictionary.longitude': 'Longitude',
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

export const WithCoordinates: Story<typeof Component> = {
  props: {
    lng: -71.5,
    lat: -16.4,
    on_update: () => {},
    on_remove: () => {},
    on_close: () => {},
  },
  interactions: async (page) => {
    await page.waitForSelector('.modal-card')
    await page.waitForSelector('.mapboxgl-marker', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 300))
  },
}
