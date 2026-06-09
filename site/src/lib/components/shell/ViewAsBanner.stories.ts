import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ViewAsBanner.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 240 }],
  csr: true,
}

function admin_user({ preview_level }: { preview_level: number }) {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u1',
      email: 'jwrunner7@gmail.com',
      name: 'Jacob Bowdoin',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: true,
      admin_level: 2,
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  auth_user.set_preview({ admin_level: preview_level })
  return auth_user
}

/** The pill shown while previewing as a Visitor. */
export const PreviewingVisitor: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_level: 0 }) },
}

/** The pill shown while previewing as a lower admin tier. */
export const PreviewingAdminLevel1: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_level: 1 }) },
}
