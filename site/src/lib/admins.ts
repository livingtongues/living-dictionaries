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
 */

export type AdminLevel = 1 | 2

export interface Admin {
  email: string
  name: string
  level: AdminLevel
}

export const ADMINS: readonly Admin[] = [
  { email: 'jwrunner7@gmail.com', name: 'Jacob Bowdoin', level: 2 },
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

  test('is_admin_at_least respects threshold', () => {
    expect(is_admin_at_least('jwrunner7@gmail.com', 1)).toBe(true)
    expect(is_admin_at_least('jwrunner7@gmail.com', 2)).toBe(true)
    expect(is_admin_at_least('random@example.com', 1)).toBe(false)
    expect(is_admin_at_least(null, 1)).toBe(false)
  })
}
