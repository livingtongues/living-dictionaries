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
const ANNA = 'dictionaries@livingtongues.org'

export const CATEGORY_ROUTING: Record<TriageCategory, string> = {
  technical: JACOB,
  content: DIEGO,
  account: ANNA,
  partnership: DIEGO,
  other: JACOB,
}

/** Jacob is the catch-all for low-confidence + spam alerts. */
export const FALLBACK_ADMIN_EMAIL = JACOB

export function route_admin_for_category(category: TriageCategory): Admin | undefined {
  const email = CATEGORY_ROUTING[category] ?? FALLBACK_ADMIN_EMAIL
  return ADMINS.find(admin => admin.email === email)
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

  test('technical/other → Jacob, content/partnership → Diego, account → Anna', () => {
    expect(route_admin_for_category('technical')?.name).toBe('Jacob Bowdoin')
    expect(route_admin_for_category('content')?.name).toBe('Diego Mariscal')
    expect(route_admin_for_category('account')?.name).toBe('Anna Luisa Daigneault')
    expect(route_admin_for_category('partnership')?.name).toBe('Diego Mariscal')
    expect(route_admin_for_category('other')?.name).toBe('Jacob Bowdoin')
  })

  test('fallback admin is Jacob', () => {
    expect(fallback_admin()?.name).toBe('Jacob Bowdoin')
  })
}
