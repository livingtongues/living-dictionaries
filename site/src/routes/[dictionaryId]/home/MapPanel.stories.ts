import type { Story, StoryMeta } from 'svelte-look'
import type Component from './MapPanel.svelte'
import type { DictionaryView } from '$lib/types'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 240 }],
  page_data: { t: mock_t, locale: 'en' },
}

const dictionary = {
  id: 'dict-1',
  name: 'Achi',
  url: 'achi',
  coordinates: {
    points: [
      { coordinates: { longitude: -90.48, latitude: 15.09 } },
      { coordinates: { longitude: -90.32, latitude: 15.47 } },
    ],
    regions: [
      { coordinates: [
        { longitude: -90.7, latitude: 14.9 },
        { longitude: -90.1, latitude: 14.9 },
        { longitude: -90.1, latitude: 15.6 },
        { longitude: -90.7, latitude: 15.6 },
      ] },
    ],
  },
} as DictionaryView

/** Static cached map fills the panel (dev/dummy token falls back to the gray placeholder). */
export const WithCoordinates: Story<typeof Component> = {
  csr: true,
  props: {
    dictionary,
    is_manager: false,
    update_dictionary: async () => {},
  },
}

/** Manager sees the dashed add-location tile when no coordinates exist yet. */
export const ManagerEmptyState: Story<typeof Component> = {
  csr: true,
  props: {
    dictionary: { ...dictionary, coordinates: null } as DictionaryView,
    is_manager: true,
    update_dictionary: async () => {},
  },
}
