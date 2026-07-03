import type { EffectiveAdminLevel } from '$lib/admins'

/**
 * Fields the client receives about the signed-in user. `admin_level` is the
 * effective tier (see Admin docstring in `$lib/admins.ts`): 0 = regular,
 * 1 = Super Manager (from `users.roles`), 2/3 = allow-list Admin/Super Admin.
 * `is_admin` means "in the admin club" (`admin_level >= 2`) — it gates the
 * /admin area; super managers are NOT admins.
 *
 * LD-specific (vs house): no `subscription`, `free_trial_ends_at`, or
 * `has_stripe_customer` — LD doesn't bill. Adds `preferred_locale` for the
 * SSR + i18n layer.
 */
export interface AuthUserData {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
  is_admin: boolean
  admin_level: EffectiveAdminLevel
  /**
   * Member of >= 1 chat room (admins always; others when added to a channel).
   * Gates the /chat entry points — the endpoints re-check membership fresh.
   */
  is_chat_member: boolean
  /**
   * Locales this user may translate on /translate (from `translator_languages`;
   * admins get every translatable locale). Empty = not a translator — gates the
   * /translate entry points; the endpoints re-check assignments fresh.
   */
  translator_locales: string[]
  /**
   * Maps to one of the locales in `lib/i18n/locales/`. NULL = derive from
   * Accept-Language or fall back to English on first load.
   */
  preferred_locale: string | null
  /** True iff `users.unsubscribed_from_emails` is non-null. Drives the newsletter toggle on /account. */
  unsubscribed_from_emails: boolean
}
