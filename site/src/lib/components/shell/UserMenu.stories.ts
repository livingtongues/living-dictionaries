import type { Story, StoryMeta } from 'svelte-look'
import type { PreviewDictRole } from '$lib/auth/view-as'
import type Component from './UserMenu.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 320, height: 480 }],
}

const t = ((key: string) => key) as never

function admin_user({ preview_level, preview_dict_role }: { preview_level?: number, preview_dict_role?: PreviewDictRole } = {}) {
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
  if (preview_level !== undefined || preview_dict_role !== undefined)
    auth_user.set_preview({ admin_level: preview_level ?? 0, dict_role: preview_dict_role })
  return auth_user
}

/** A real level-3 super admin sees the full ladder; the top rung (their real level) is checked. */
export const AdminLadder: Story<typeof Component> = {
  props: { close: () => {} },
  page_data: { auth_user: admin_user(), t },
}

/** While previewing as a Visitor, the Admin Panel link is gone and the visitor rung is checked. */
export const PreviewingVisitor: Story<typeof Component> = {
  props: { close: () => {} },
  page_data: { auth_user: admin_user({ preview_level: 0 }), t },
}

/** Previewing the dictionary-scoped Manager persona — the Manager rung is checked. */
export const PreviewingManager: Story<typeof Component> = {
  props: { close: () => {} },
  page_data: { auth_user: admin_user({ preview_dict_role: 'manager' }), t },
}
