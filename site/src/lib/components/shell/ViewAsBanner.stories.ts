import type { Story, StoryMeta } from 'svelte-look'
import type { PreviewDictRole } from '$lib/auth/view-as'
import type Component from './ViewAsBanner.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 240 }],
}

function admin_user({ preview_level, preview_dict_role }: { preview_level?: number, preview_dict_role?: PreviewDictRole }) {
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
  auth_user.set_preview({ admin_level: preview_level ?? 0, dict_role: preview_dict_role })
  return auth_user
}

/** The pill shown while previewing as a Visitor. */
export const PreviewingVisitor: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_level: 0 }) },
}

/** The pill shown while previewing as a lower tier (Super Manager). */
export const PreviewingSuperManager: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_level: 1 }) },
}

/** The pill shown while previewing the dictionary-scoped Manager persona. */
export const PreviewingManager: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_dict_role: 'manager' }) },
}

/** The pill shown while previewing the dictionary-scoped Editor persona. */
export const PreviewingEditor: Story<typeof Component> = {
  page_data: { auth_user: admin_user({ preview_dict_role: 'editor' }) },
}
