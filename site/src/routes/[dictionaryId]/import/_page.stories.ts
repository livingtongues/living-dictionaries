import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

const dictionary = { id: 'demo', url: 'demo', name: 'Nahuatl', public: true }

/** Manager: education + dropzone (file list empty — no session in stories). */
export const Manager: PageStory<typeof Component> = {
  viewports: [{ width: 900, height: 1000 }, { width: 390, height: 1100 }],
  props: { dictionary, is_manager: true } as never,
}

/** Everyone else: education + managers-only note + contact. */
export const NotManager: PageStory<typeof Component> = {
  props: { dictionary, is_manager: false } as never,
}
