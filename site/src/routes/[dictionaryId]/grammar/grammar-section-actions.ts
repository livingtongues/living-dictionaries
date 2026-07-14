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
  editable: boolean
  editing_id: string | null
  set_editing: (id: string | null) => void
  move_up: (node: GrammarNode) => void
  move_down: (node: GrammarNode) => void
  indent: (node: GrammarNode) => void
  outdent: (node: GrammarNode) => void
  remove: (node: GrammarNode) => void
  add_child: (node: GrammarNode) => void
}
