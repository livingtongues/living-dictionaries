import type { Story, StoryMeta } from 'svelte-look'
import type Component from './UserMenu.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 480 }],
}

const t = ((key: string) => key) as never

function admin_user({ preview_level }: { preview_level?: number } = {}) {
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
  if (preview_level !== undefined)
    auth_user.set_preview({ admin_level: preview_level })
  return auth_user
}

/** A real level-2 admin sees the full ladder; the top rung (their real level) is checked. */
export const AdminLadder: Story<typeof Component> = {
  props: { close: () => {} },
  page_data: { auth_user: admin_user(), t },
}

/** While previewing as a Visitor, the Admin Panel link is gone and the visitor rung is checked. */
export const PreviewingVisitor: Story<typeof Component> = {
  props: { close: () => {} },
  page_data: { auth_user: admin_user({ preview_level: 0 }), t },
}
