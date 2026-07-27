/**
 * Render gate for the structured grammar section tree (.issues/structured-grammar.md).
 * Parallels `corpus-preview-guard.ts` but is RENDER-conditional (no route
 * redirect).
 *
 * CUTOVER (2026-07-15): the blob→sections backfill ran and `grammar_sections_visible`
 * widened to PUBLIC — the grammar page renders the section tree for everyone.
 *
 * GRADUATED (2026-07-27, Ponca import): structural editing widened from admin-3
 * to **dictionary managers**. The gate existed so nobody would write into an
 * unstable shape; the shape has been stable since the cutover, and importing
 * someone's 40-page grammar into a tree they cannot correct is worse than the
 * risk it guarded against. Admin-3 still passes without a manager role. Kept as
 * functions so this stays a single revert lever + the edit gate has one home.
 */

const GRAMMAR_SECTIONS_ADMIN_LEVEL = 3

/** Who can SEE the section tree. Public since the 2026-07-15 cutover. */
export function grammar_sections_visible(_args?: {
  auth_user?: { admin_level?: number } | null | undefined
}): boolean {
  return true
}

/** Who can do STRUCTURAL editing (add / reorder / nest / link / slots / delete). */
export function grammar_sections_editable({ auth_user, is_manager = false }: {
  auth_user: { admin_level?: number } | null | undefined
  /** Manager of the dictionary being viewed (site admins bypass separately). */
  is_manager?: boolean
}): boolean {
  return is_manager || (auth_user?.admin_level ?? 0) >= GRAMMAR_SECTIONS_ADMIN_LEVEL
}

if (import.meta.vitest) {
  describe(grammar_sections_editable, () => {
    test('managers of the dictionary may restructure it', () => {
      expect(grammar_sections_editable({ auth_user: null, is_manager: true })).toBe(true)
    })

    test('a signed-out or non-manager visitor may not', () => {
      expect(grammar_sections_editable({ auth_user: null })).toBe(false)
      expect(grammar_sections_editable({ auth_user: { admin_level: 0 }, is_manager: false })).toBe(false)
    })

    test('site admins still pass without a manager role', () => {
      expect(grammar_sections_editable({ auth_user: { admin_level: 3 } })).toBe(true)
      expect(grammar_sections_editable({ auth_user: { admin_level: 2 } })).toBe(false)
    })
  })
}
