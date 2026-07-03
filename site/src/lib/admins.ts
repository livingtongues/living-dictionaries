/**
 * Hardcoded admin allow-list for Living Dictionaries.
 *
 * Living Dictionaries uses four effective admin levels:
 *   0 — regular user
 *   1 — Super Manager: NOT in this list — granted via the `users.roles` DB
 *       column containing 'super_manager' (toggled from /admin/users/[id]).
 *       Behaves like a dictionary manager on EVERY dictionary (`>= 1` gates:
 *       edit any dict, see private dicts/tags) but has NO /admin access.
 *   2 — Admin (`>= 2` gates: the /admin area, users, messages)
 *   3 — Super Admin / dev (`>= 3` gates: settings page dev section,
 *       dev fields, v4-internal tags)
 *
 * `is_admin(email)` returns true only for allow-listed admins (level >= 2) —
 * super managers are NOT admins.
 *
 * `ntfy_topic` — each admin gets their own random topic on ntfy.sh so they can
 * subscribe on their phone (open the ntfy app, "subscribe to topic", paste).
 * Topic names ARE the auth on ntfy.sh's free public service — they're random
 * (~64 bits of entropy) so nobody else can spam-push to your phone. Keep
 * topics secret to the admin; treat them like passwords. Used by
 * `lib/notifications/notify-admins.ts`; `NTFY_DISABLED=1` silences in dev/test.
 */

export type AdminLevel = 2 | 3

/** The full effective tier: allow-list levels plus 1 (Super Manager via `users.roles`) and 0 (regular user). */
export type EffectiveAdminLevel = 0 | 1 | 2 | 3

/**
 * DB-grantable site-wide roles (`users.roles` JSON array). Deliberately NOT
 * part of the hardcoded allow-list so admins can toggle them at runtime, and
 * so a DB write can never escalate anyone into the admin club (levels 2/3).
 * Today only `super_manager` (effective level 1); `super_editor` is a
 * foreseen future addition.
 */
export const SITE_ROLES = ['super_manager'] as const
export type SiteRole = typeof SITE_ROLES[number]

export function has_super_manager_role(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.includes('super_manager' satisfies SiteRole)
}

export interface Admin {
  email: string
  name: string
  ntfy_topic: string
  /**
   * The admin's `*@livingdictionaries.app` outbound address. Message-backend
   * replies are sent FROM this address so customers see the specific admin
   * (`jacob@livingdictionaries.app`, …), not a generic `support@`. Replies from
   * customers land back here and route via the CF Worker catch-all →
   * `email-inbound`, same as any other `*@livingdictionaries.app`.
   */
  ld_address: string
  level: AdminLevel
  /**
   * Off-duty admins keep admin + chat ACCESS but are skipped by broadcast inbound
   * notifications (`notify_admins`) and chat gentle re-pings. Absent = on duty.
   * (They're also left out of the AI-triage routing map, so nothing auto-assigns to them.)
   */
  notify?: boolean
}

export const ADMINS: readonly Admin[] = [
  { email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', ntfy_topic: 'living_pings', ld_address: 'jacob@livingdictionaries.app', level: 3 },
  { email: 'diego@livingtongues.org', name: 'Diego Córdova', ntfy_topic: 'living_pings_diego', ld_address: 'diego@livingdictionaries.app', level: 3 },
  { email: 'dictionaries@livingtongues.org', name: 'Anna Luisa Daigneault', ntfy_topic: 'living_pings_anna', ld_address: 'annaluisa@livingdictionaries.app', level: 2, notify: false },
  { email: 'livingtongues@gmail.com', name: 'Dr. Greg Anderson', ntfy_topic: 'living_pings_greg', ld_address: 'greg@livingdictionaries.app', level: 2 },
]

export function is_admin(email: string | undefined | null): boolean {
  return !!email && ADMINS.some(admin => admin.email === email)
}

export function get_admin(email: string | undefined | null): Admin | undefined {
  if (!email)
    return undefined
  return ADMINS.find(admin => admin.email === email)
}

export function get_admin_name(email: string | undefined | null): string | undefined {
  return get_admin(email)?.name
}

export function get_admin_level(email: string | undefined | null): AdminLevel | null {
  return get_admin(email)?.level ?? null
}

export function is_admin_at_least(email: string | undefined | null, min_level: AdminLevel): boolean {
  const level = get_admin_level(email)
  return level !== null && level >= min_level
}

/** Our own outbound domain — mail from here is never customer mail. */
export const INTERNAL_EMAIL_DOMAIN = 'livingdictionaries.app'

/**
 * True when an inbound `from_email` is US, not a customer: any
 * `*@livingdictionaries.app` address (admins' `ld_address`es, `no-reply@`
 * OTP/system mail that can loop back into the catch-all) OR an admin's own
 * login email. The triage pipeline skips these — they should never be
 * classified, pinged, or spam-resolved.
 */
export function is_internal_email(email: string | undefined | null): boolean {
  if (!email)
    return false
  const lower = email.trim().toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at === -1)
    return false
  if (lower.slice(at + 1) === INTERNAL_EMAIL_DOMAIN)
    return true
  return ADMINS.some(admin => admin.email.toLowerCase() === lower)
}

if (import.meta.vitest) {
  test('is_admin true for allow-listed email', () => {
    expect(is_admin('jwrunner7@gmail.com')).toBe(true)
  })

  test('is_admin false for unknown email', () => {
    expect(is_admin('alice@example.com')).toBe(false)
  })

  test('is_admin false for null/undefined/empty', () => {
    expect(is_admin(null)).toBe(false)
    expect(is_admin(undefined)).toBe(false)
    expect(is_admin('')).toBe(false)
  })

  test('every admin has a valid level (2 or 3)', () => {
    for (const admin of ADMINS)
      expect([2, 3]).toContain(admin.level)
  })

  test('has_super_manager_role only matches the super_manager role', () => {
    expect(has_super_manager_role(['super_manager'])).toBe(true)
    expect(has_super_manager_role(['other_role'])).toBe(false)
    expect(has_super_manager_role([])).toBe(false)
    expect(has_super_manager_role(null)).toBe(false)
    expect(has_super_manager_role(undefined)).toBe(false)
  })

  test('every admin has a unique non-empty ntfy_topic', () => {
    const topics = ADMINS.map(admin => admin.ntfy_topic)
    expect(topics.every(topic => topic && topic.length >= 10)).toBe(true)
    expect(new Set(topics).size).toBe(topics.length)
  })

  test('every admin has a unique @livingdictionaries.app ld_address', () => {
    const addresses = ADMINS.map(admin => admin.ld_address)
    expect(addresses.every(address => address.endsWith('@livingdictionaries.app'))).toBe(true)
    expect(new Set(addresses).size).toBe(addresses.length)
  })

  test('is_admin_at_least respects threshold', () => {
    expect(is_admin_at_least('jwrunner7@gmail.com', 2)).toBe(true)
    expect(is_admin_at_least('jwrunner7@gmail.com', 3)).toBe(true)
    expect(is_admin_at_least('livingtongues@gmail.com', 3)).toBe(false)
    expect(is_admin_at_least('random@example.com', 2)).toBe(false)
    expect(is_admin_at_least(null, 2)).toBe(false)
  })

  test('is_internal_email: our domain + admin logins are internal', () => {
    expect(is_internal_email('no-reply@livingdictionaries.app')).toBe(true)
    expect(is_internal_email('jacob@livingdictionaries.app')).toBe(true)
    expect(is_internal_email('JWRunner7@gmail.com')).toBe(true)
    expect(is_internal_email('reader@gmail.com')).toBe(false)
    expect(is_internal_email(null)).toBe(false)
    expect(is_internal_email('garbage')).toBe(false)
  })
}
