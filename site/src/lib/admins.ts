/**
 * Hardcoded admin allow-list for Living Dictionaries.
 *
 * Living Dictionaries uses three integer admin levels (legacy LD convention):
 *   0 — regular user (not in this list)
 *   1 — editor admin (`> 0` gates: delete-dictionary, upload endpoints)
 *   2 — super-user / dev admin (`> 1` and `=== 2` gates: settings page,
 *       dev fields, v4-internal tags)
 *
 * `is_admin(email)` returns true for ANY level (admin_level >= 1).
 *
 * `ntfy_topic` — each admin gets their own random topic on ntfy.sh so they can
 * subscribe on their phone (open the ntfy app, "subscribe to topic", paste).
 * Topic names ARE the auth on ntfy.sh's free public service — they're random
 * (~64 bits of entropy) so nobody else can spam-push to your phone. Keep
 * topics secret to the admin; treat them like passwords. Used by
 * `lib/notifications/notify-admins.ts`; `NTFY_DISABLED=1` silences in dev/test.
 */

export type AdminLevel = 1 | 2

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
}

export const ADMINS: readonly Admin[] = [
  { email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', ntfy_topic: 'living_pings', ld_address: 'jacob@livingdictionaries.app', level: 2 },
  { email: 'diego@livingtongues.org', name: 'Diego Mariscal', ntfy_topic: 'living_pings_diego', ld_address: 'diego@livingdictionaries.app', level: 2 },
  { email: 'dictionaries@livingtongues.org', name: 'Anna Luisa Daigneault', ntfy_topic: 'living_pings_anna', ld_address: 'anna@livingdictionaries.app', level: 1 },
  { email: 'livingtongues@gmail.com', name: 'Dr. Greg Anderson', ntfy_topic: 'living_pings_greg', ld_address: 'greg@livingdictionaries.app', level: 1 },
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

  test('every admin has a valid level (1 or 2)', () => {
    for (const admin of ADMINS)
      expect([1, 2]).toContain(admin.level)
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
    expect(is_admin_at_least('jwrunner7@gmail.com', 1)).toBe(true)
    expect(is_admin_at_least('jwrunner7@gmail.com', 2)).toBe(true)
    expect(is_admin_at_least('random@example.com', 1)).toBe(false)
    expect(is_admin_at_least(null, 1)).toBe(false)
  })
}
