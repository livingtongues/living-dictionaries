import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  flavors: false,
  page_data: { t: mock_t, auth_user: { user: null, is_admin: false } },
}

/** Signed-out visitor: intro copy + name field + FAQ sections (form expands on typing). */
export const Visitor: PageStory<typeof Component> = {
  props: {
    auth_user: { user: null },
    MIN_URL_LENGTH: 3,
    dictionary_id_exists: async () => false,
    create_dictionary: async () => {},
  } as never,
}

export const VisitorDesktop: PageStory<typeof Component> = {
  viewports: [{ width: 1100, height: 800 }],
  props: {
    auth_user: { user: null },
    MIN_URL_LENGTH: 3,
    dictionary_id_exists: async () => false,
    create_dictionary: async () => {},
  } as never,
}

/** Typed a name + answered "constructed language: yes" — shows the matter-of-fact conlang terms. */
export const ConlangBranch: PageStory<typeof Component> = {
  viewports: [{ width: 640, height: 1400 }],
  csr: true,
  interactions: async (page) => {
    await page.type('#name', 'Talossan')
    await page.click('input[name="conlang"][value="true"]')
  },
  props: {
    auth_user: { user: null },
    MIN_URL_LENGTH: 3,
    dictionary_id_exists: async () => false,
    create_dictionary: async () => {},
  } as never,
}
