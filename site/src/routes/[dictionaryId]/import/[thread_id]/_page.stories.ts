import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, params: { thread_id: 't1' } },
}

const dictionary = { id: 'demo', url: 'demo', name: 'Nahuatl', public: true }

/**
 * Manager view. Stories have no session, so the conversation fetch 401s and the
 * page settles on its not-found state — enough to check the chrome and the back
 * link; the blocks themselves have their own component stories.
 */
export const Manager: PageStory<typeof Component> = {
  viewports: [{ width: 900, height: 700 }, { width: 390, height: 700 }],
  props: { dictionary, is_manager: true } as never,
}

/** Contributors and visitors get the managers-only note. */
export const NotManager: PageStory<typeof Component> = {
  props: { dictionary, is_manager: false } as never,
}
