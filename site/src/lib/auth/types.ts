import type { AdminLevel } from '$lib/admins'

/**
 * Fields the client receives about the signed-in user. `is_admin` is computed
 * server-side (not stored on `users`) by `is_admin(email)` from
 * `$lib/admins.ts`. `admin_level` is the tiered version: `null` for
 * non-admins, `1 | 2` otherwise (see Admin docstring in `$lib/admins.ts`).
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
  admin_level: AdminLevel | null
  /**
   * Maps to one of the locales in `lib/i18n/locales/`. NULL = derive from
   * Accept-Language or fall back to English on first load.
   */
  preferred_locale: string | null
  /** True iff `users.unsubscribed_from_emails` is non-null. Drives the newsletter toggle on /account. */
  unsubscribed_from_emails: boolean
}
