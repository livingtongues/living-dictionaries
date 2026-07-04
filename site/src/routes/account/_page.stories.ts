import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { AuthUser } from '$lib/auth/user.svelte'

const EN: Record<string, string> = {
  'account.account_settings': 'Account Settings',
  'account.your_name': 'Your Name',
  'account.log_out': 'Log Out',
  'account.admin_panel': 'Admin Panel',
  'account.receive_newsletter': 'Receive newsletter updates',
  'misc.save': 'Save',
  'misc.error': 'Error',
}
const t = ((key: string) => EN[key] ?? key) as never

function user({ admin_level = 0, unsubscribed = false }: { admin_level?: number, unsubscribed?: boolean } = {}) {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u-1',
      email: 'maria@example.com',
      name: 'Maria Lopez',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: admin_level >= 2,
      admin_level: admin_level as never,
      is_chat_member: admin_level >= 2,
      translator_locales: [],
      preferred_locale: null,
      unsubscribed_from_emails: unsubscribed,
    },
  })
  return auth_user
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 460 }],
  flavors: false,
  page_data: { t },
}

/** Signed-in non-admin: name, email, newsletter subscribed. */
export const Member: PageStory<typeof Component> = {
  props: { auth_user: user() } as never,
}

/** Admin: shows the Admin Panel link, newsletter unsubscribed. */
export const Admin: PageStory<typeof Component> = {
  viewports: [{ width: 640, height: 520 }],
  props: { auth_user: user({ admin_level: 3, unsubscribed: true }) } as never,
}
