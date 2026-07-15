import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
import type { GrammarTreeNode } from './grammar-tree'

export type GrammarNode = GrammarTreeNode<DictRowType<'grammar_sections'>>

/**
 * The edit operations a `GrammarSection` node fires up to the tree owner
 * (`GrammarSectionsView`), which holds the flat rows + does the fractional
 * `sort_key` / `parent_id` math and the DB writes. Passed unchanged down the
 * recursive render so every node shares one handler set.
 */
export interface GrammarSectionActions {
  /** Admin-3: full STRUCTURAL editing (add/reorder/nest/link/slots/delete + full SectionEditor). */
  editable: boolean
  /** Manager (non-admin-3): scoped body-only editing of the migrated intro section. */
  prose_editable: boolean
  editing_id: string | null
  set_editing: (id: string | null) => void
  move_up: (node: GrammarNode) => void
  move_down: (node: GrammarNode) => void
  indent: (node: GrammarNode) => void
  outdent: (node: GrammarNode) => void
  remove: (node: GrammarNode) => void
  add_child: (node: GrammarNode) => void
}

/**
 * Which nodes a plain manager may edit the prose of: the migrated grammar
 * "intro" — a top-level (depth 0) headless (no title in any language) section.
 * Structural sections that admin-3 authors carry a title, so they stay
 * admin-3-only. A manager editing here only touches the per-language `body`.
 */
export function prose_editable_node(node: GrammarNode): boolean {
  if (node.depth !== 0)
    return false
  const { title } = node.section
  return !title || !Object.values(title).some(value => value?.trim())
}
