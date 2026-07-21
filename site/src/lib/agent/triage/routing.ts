import type { TriageCategory } from './constants'
import type { Admin } from '$lib/admins'
import { ADMINS } from '$lib/admins'

/**
 * Category → admin EMAIL routing. Single source of truth for who handles what —
 * the `RoutingLegend` component renders straight from this map. Low-confidence +
 * spam route to Jacob regardless (handled in apply-triage, not here).
 *
 * Single-admin per category (no multi-assign): content + partnership go to
 * Diego (Jacob's call — "just ping Diego for those"). Adding a second admin
 * later is a one-line schema change, not done now.
 */
const JACOB = 'jwrunner7@gmail.com'
const DIEGO = 'diego@livingtongues.org'

// Account issues go to Jacob (login/access issues are technical-adjacent,
// and he's the technical + other + fallback owner).
export const CATEGORY_ROUTING: Record<TriageCategory, string> = {
  technical: JACOB,
  content: DIEGO,
  account: JACOB,
  partnership: DIEGO,
  other: JACOB,
}

/** Jacob is the catch-all for low-confidence + spam alerts. */
export const FALLBACK_ADMIN_EMAIL = JACOB

export function route_admin_for_category(category: TriageCategory): Admin | undefined {
  const email = CATEGORY_ROUTING[category] ?? FALLBACK_ADMIN_EMAIL
  return ADMINS.find(admin => admin.email === email)
}

/** Import requests are operational work owned by Jacob, independent of content triage. */
export function route_admin_for_imports(): Admin | undefined {
  return ADMINS.find(admin => admin.email === JACOB)
}

export function fallback_admin(): Admin | undefined {
  return ADMINS.find(admin => admin.email === FALLBACK_ADMIN_EMAIL)
}

if (import.meta.vitest) {
  test('every category routes to a real admin', () => {
    for (const category of Object.keys(CATEGORY_ROUTING) as (keyof typeof CATEGORY_ROUTING)[]) {
      const admin = route_admin_for_category(category)
      expect(admin).toBeDefined()
      expect(admin?.email).toBe(CATEGORY_ROUTING[category])
    }
  })

  test('technical/account/other → Jacob, content/partnership → Diego', () => {
    expect(route_admin_for_category('technical')?.name).toBe('Jacob Bowdoin')
    expect(route_admin_for_category('content')?.name).toBe('Diego Córdova')
    expect(route_admin_for_category('account')?.name).toBe('Jacob Bowdoin')
    expect(route_admin_for_category('partnership')?.name).toBe('Diego Córdova')
    expect(route_admin_for_category('other')?.name).toBe('Jacob Bowdoin')
  })

  test('no category routes to an off-duty admin', () => {
    const off_duty_emails = ADMINS.filter(a => a.notify === false).map(a => a.email)
    for (const email of Object.values(CATEGORY_ROUTING))
      expect(off_duty_emails).not.toContain(email)
  })

  test('fallback admin is Jacob', () => {
    expect(fallback_admin()?.name).toBe('Jacob Bowdoin')
  })

  test('import requests route to Jacob without changing content routing', () => {
    expect(route_admin_for_imports()?.name).toBe('Jacob Bowdoin')
    expect(route_admin_for_category('content')?.name).toBe('Diego Córdova')
  })
}
