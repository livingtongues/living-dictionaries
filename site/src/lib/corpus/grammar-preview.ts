/**
 * Render gate for the structured grammar section tree while its data shape is
 * iterated on (.issues/structured-grammar.md). Parallels
 * `corpus-preview-guard.ts` but is RENDER-conditional (no route redirect): the
 * grammar page is public and keeps showing the legacy `dictionaries.grammar`
 * blob to everyone; only admin-3 additionally sees / edits the section tree.
 *
 * CUTOVER (lands with this milestone's deploy): run the blob→sections backfill
 * AND relax `grammar_sections_visible` to public (drop the admin-3 check) in the
 * SAME deploy, so the public grammar page flips from blob to section render with
 * no gap. The EDIT gate (`grammar_sections_editable`) stays admin-3 until GA.
 */

const GRAMMAR_SECTIONS_ADMIN_LEVEL = 3

/** Who can SEE the section tree. Admin-3 during preview; widens to everyone at cutover. */
export function grammar_sections_visible({ auth_user }: {
  auth_user: { admin_level?: number } | null | undefined
}): boolean {
  return (auth_user?.admin_level ?? 0) >= GRAMMAR_SECTIONS_ADMIN_LEVEL
}

/** Who can EDIT the section tree (add / reorder / nest / link). Admin-3 until GA. */
export function grammar_sections_editable({ auth_user }: {
  auth_user: { admin_level?: number } | null | undefined
}): boolean {
  return (auth_user?.admin_level ?? 0) >= GRAMMAR_SECTIONS_ADMIN_LEVEL
}
