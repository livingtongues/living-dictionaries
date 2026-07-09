import type { Story, StoryMeta } from 'svelte-look'
import type Component from './WhereSpoken.svelte'

export const shared_meta: StoryMeta = {
  csr: true,
  viewports: [{ width: 700, height: 420 }],
  page_data: {
    t: (key: string | { dynamicKey?: string, fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || key.dynamicKey || ''
      const labels: Record<string, string> = {
        'create.where_spoken': 'Where is this language spoken?',
        'create.map_instructions': 'Click on the map to add secondary coordinates.',
        'create.select_coordinates': 'Select Coordinates',
        'create.select_region': 'Select Region',
        'create.primary_coordinate': 'Primary Coordinate',
        'map.webgl_unavailable': 'Map unavailable (WebGL is disabled or unsupported in this browser).',
      }
      return labels[key] || key
    },
  },
}

export const RiverDictionaryCoordinates: Story<typeof Component> = {
  props: {
    dictionary: {
      coordinates: {
        points: [
          {
            coordinates: {
              longitude: -84.0833,
              latitude: 9.75,
            },
          },
        ],
      },
    },
    on_update_points: () => {},
    on_update_regions: () => {},
  },
  interactions: async (page) => {
    await page.waitForSelector('.mapboxgl-marker', { timeout: 10000 })
    await new Promise(resolve => setTimeout(resolve, 300))
  },
}

export const NoCoordinates: Story<typeof Component> = {
  props: {
    dictionary: {},
    on_update_points: () => {},
    on_update_regions: () => {},
  },
}
