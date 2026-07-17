import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

export const Default: PageStory<typeof Component> = {
  props: {
    dictionary: { id: 'demo', url: 'demo', name: 'Nahuatl', public: true },
    is_manager: true,
  } as never,
}

export const NoAccess: PageStory<typeof Component> = {
  props: {
    dictionary: { id: 'demo', url: 'demo', name: 'Nahuatl', public: true },
    is_manager: false,
  } as never,
}

export const ApiUnavailableConlang: PageStory<typeof Component> = {
  props: {
    dictionary: { id: 'demo', url: 'demo', name: 'Sindarin', public: false, bucket: 'conlang' },
    is_manager: true,
  } as never,
}
