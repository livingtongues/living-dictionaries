import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SelectLanguage.svelte'
import { AuthUser } from '$lib/auth/user.svelte'
import { en } from '$lib/i18n'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 460, height: 760 }],
}

const t = ((key: string, opts?: { values?: Record<string, string> }) => {
  const period = key.indexOf('.')
  const section = key.slice(0, period)
  const item = key.slice(period + 1)
  let value = (en as Record<string, Record<string, string>>)[section]?.[item] ?? key
  for (const [token, replacement] of Object.entries(opts?.values ?? {}))
    value = value.replaceAll(`{${token}}`, replacement)
  return value
}) as never

function make_user({ admin = false }: { admin?: boolean } = {}) {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u1',
      email: 'michel@example.com',
      name: 'Michel',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: admin,
      admin_level: admin ? 3 : 0,
      is_chat_member: admin,
      translator_locales: [],
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  return auth_user
}

const logged_out = new AuthUser()

// Languages that already have an assigned translator — these show NO recruiting prompt.
const covered = ['es', 'zh', 'ru', 'he', 'hi', 'as']

/** A signed-in visitor browsing in German (uncovered → the row is active AND shows Volunteer). */
export const SignedIn: Story<typeof Component> = {
  props: { on_close: () => {} },
  page_data: { auth_user: make_user(), locale: 'de', t, locales_with_translators: covered },
}

/** An admin also sees the unpublished (🔑) locales below the published list. */
export const AsAdmin: Story<typeof Component> = {
  props: { on_close: () => {} },
  page_data: { auth_user: make_user({ admin: true }), locale: 'en', t, locales_with_translators: covered },
}

/** Logged out — clicking Volunteer opens the sign-in modal first (not captured here). */
export const LoggedOut: Story<typeof Component> = {
  props: { on_close: () => {} },
  page_data: { auth_user: logged_out, locale: 'ar', t, locales_with_translators: covered },
}
