import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+layout.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 500 }],
}

// NOTE: svelte-look folds all page/layout props into `data`, so a layout story
// cannot pass a `children` snippet — the layout render is optional-chained.

const t = ((key: string) => key) as never

function admin_user() {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u1',
      email: 'jwrunner7@gmail.com',
      name: 'Jacob Bowdoin',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: true,
      admin_level: 3,
      is_chat_member: true,
      translator_locales: [],
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  return auth_user
}

export const SignedOut: PageStory<typeof Component> = {
  props: {
    auth_user: { user: null, logout: () => {} },
    db: null,
    sync: null,
  } as never,
}

/** Icon nav (house-parity): Messages/Team/Dictionaries keep labels, the rest are icon-only; shared site User menu at right. */
export const SignedIn: PageStory<typeof Component> = {
  props: {
    auth_user: admin_user(),
    db: null,
    sync: null,
  } as never,
  page_data: { auth_user: admin_user(), t },
}

export const SignedInMobile: PageStory<typeof Component> = {
  viewports: [{ width: 400, height: 300 }],
  props: {
    auth_user: admin_user(),
    db: null,
    sync: null,
  } as never,
  page_data: { auth_user: admin_user(), t },
}
