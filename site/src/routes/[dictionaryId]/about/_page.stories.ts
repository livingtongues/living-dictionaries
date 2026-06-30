import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  about: '<p>The Nahuatl Living Dictionary documents the speech of the highland communities, gathered over field seasons with elder speakers.</p>',
}

const shared_props = {
  dictionary,
  is_contributor: false,
  update_about: async () => {},
  auth_user: { admin_level: 0, is_admin: false },
} as never

export const Viewer: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: false } as never,
}

export const ManagerWithContent: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: true } as never,
}

export const ManagerEmpty: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: true, dictionary: { ...dictionary, about: '' } } as never,
}
