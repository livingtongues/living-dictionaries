import type { PageStory, StoryMeta } from 'svelte-look'
import { readable } from 'svelte/store'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

const sources = readable([
  { id: '1', slug: 'smith-2001', abbreviation: 'Smith 2001', citation: 'Smith, J. (2001). A Dictionary of Example.', type: 'dictionary' },
  { id: '2', slug: 'fieldwork', abbreviation: null, citation: 'Fieldwork notes, 2023', type: 'fieldwork' },
] as never)

export const shared_meta: StoryMeta = {
  page_data: {
    t: mock_t,
    sources,
    can_edit: true,
    connection: null,
    dbOperations: { remove_source_and_delete: async () => {} },
  },
}

export const Default: PageStory<typeof Component> = {}

export const ReadOnly: PageStory<typeof Component> = {
  page_data: { can_edit: false },
}
