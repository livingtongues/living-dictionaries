/**
 * Render gate for the structured grammar section tree (.issues/structured-grammar.md).
 * Parallels `corpus-preview-guard.ts` but is RENDER-conditional (no route
 * redirect).
 *
 * CUTOVER (2026-07-15): the blob→sections backfill ran and `grammar_sections_visible`
 * widened to PUBLIC — the grammar page renders the section tree for everyone (the
 * legacy `dictionaries.grammar` blob stays only as a read-only fallback for any
 * not-yet-backfilled dict, until a later deploy drops the column). STRUCTURAL
 * editing (`grammar_sections_editable`) stays admin-3 until GA; managers keep a
 * scoped intro-prose editor (see the grammar page). Kept as functions so the
 * visibility flip is a single revert lever + the edit gate has one home.
 */

const GRAMMAR_SECTIONS_ADMIN_LEVEL = 3

/** Who can SEE the section tree. Public since the 2026-07-15 cutover. */
export function grammar_sections_visible(_args?: {
  auth_user?: { admin_level?: number } | null | undefined
}): boolean {
  return true
}

/** Who can do STRUCTURAL editing (add / reorder / nest / link / slots / delete). Admin-3 until GA. */
export function grammar_sections_editable({ auth_user }: {
  auth_user: { admin_level?: number } | null | undefined
}): boolean {
  return (auth_user?.admin_level ?? 0) >= GRAMMAR_SECTIONS_ADMIN_LEVEL
}
