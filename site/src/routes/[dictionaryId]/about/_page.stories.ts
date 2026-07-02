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
  about: '## Our story\n\nThe **Nahuatl** Living Dictionary documents the speech of the highland communities, gathered over field seasons with *elder speakers*.\n\n- Recordings from three villages\n- Reviewed by community managers',
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

// Pre-cutover rows still hold CKEditor HTML — pins the html-era read shim.
export const HtmlEraContent: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: false, dictionary: { ...dictionary, about: '<h2>Our story</h2><p>The <strong>Nahuatl</strong> Living Dictionary documents the speech of the highland communities.</p>' } } as never,
}
