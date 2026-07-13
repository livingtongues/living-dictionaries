import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DialectsManager.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  coordinates: { points: [{ coordinates: { longitude: -98, latitude: 19 } }] },
} as never

const dict_db = {
  dialects: {
    update: async () => {},
    delete: async () => {},
  },
} as never

const dialects = readable([
  { id: 'd1', name: { default: 'Coastal' }, coordinates: { points: [{ coordinates: { longitude: -98, latitude: 19 }, label: 'Village' }] } },
  { id: 'd2', name: { default: 'Highland' }, coordinates: { regions: [{ coordinates: [{ longitude: -97, latitude: 20 }, { longitude: -96, latitude: 20 }, { longitude: -96.5, latitude: 21 }] }] } },
  { id: 'd3', name: { default: 'Northern' }, coordinates: null },
])

export const shared_meta: StoryMeta = {
  viewports: [{ width: 700, height: 480 }],
  page_data: { t: mock_t, dialects, dict_db, can_edit: true, dictionary },
}

export const WithDialects: Story<typeof Component> = {
  props: {},
}

export const Empty: Story<typeof Component> = {
  page_data: { t: mock_t, dialects: readable([]), dict_db, can_edit: true, dictionary },
  props: {},
}
