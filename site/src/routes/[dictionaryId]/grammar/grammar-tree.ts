import { key_between } from '$lib/api/v1/fractional-index'

/**
 * Pure tree helpers for the structured grammar page. The `grammar_sections`
 * table is a flat list of rows self-referencing via `parent_id` and ordered
 * AMONG SIBLINGS by fractional `sort_key`; the UI needs it as a nested,
 * numbered tree plus the fractional-key math for the reorder/nest buttons.
 * Kept side-effect-free so the ordering/nesting logic is unit-testable without
 * a DB or a component.
 */

export interface GrammarSectionLike {
  id: string
  parent_id?: string | null
  sort_key: string
  /** Explicit label ("2.2.1.1"); when absent, the positional number is used. */
  number_label?: string | null
}

export interface GrammarTreeNode<T extends GrammarSectionLike> {
  section: T
  /** Displayed number: the row's own `number_label`, else the derived positional one ("1.2.1"). */
  number: string
  /** Positional number derived purely from tree position — children number off THIS, not the override. */
  positional_number: string
  depth: number
  /** 0-based position among its siblings — drives move-up/down/indent button enablement. */
  index: number
  /** How many siblings share this node's parent (including itself). */
  sibling_count: number
  children: GrammarTreeNode<T>[]
}

function compare_siblings<T extends GrammarSectionLike>(first: T, second: T): number {
  return (first.sort_key || '').localeCompare(second.sort_key || '')
    || first.id.localeCompare(second.id)
}

/**
 * Nest a flat row list into a numbered tree. Rows whose `parent_id` points at a
 * missing row (or at themselves) are treated as roots so a broken link can
 * never hide a section. Ordering within each sibling group is by `sort_key`
 * (id as a stable tiebreak).
 */
export function build_section_tree<T extends GrammarSectionLike>(rows: T[]): GrammarTreeNode<T>[] {
  const by_id = new Map(rows.map(row => [row.id, row]))
  const children_of = new Map<string | null, T[]>()

  for (const row of rows) {
    const raw_parent = row.parent_id ?? null
    const parent_key = raw_parent && raw_parent !== row.id && by_id.has(raw_parent) ? raw_parent : null
    const bucket = children_of.get(parent_key)
    if (bucket)
      bucket.push(row)
    else
      children_of.set(parent_key, [row])
  }

  function build(parent_key: string | null, prefix: string, depth: number): GrammarTreeNode<T>[] {
    const siblings = (children_of.get(parent_key) ?? []).slice().sort(compare_siblings)
    return siblings.map((section, index) => {
      const positional_number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
      return {
        section,
        positional_number,
        number: section.number_label || positional_number,
        depth,
        index,
        sibling_count: siblings.length,
        children: build(section.id, positional_number, depth + 1),
      }
    })
  }

  return build(null, '', 0)
}

/**
 * The ordered sibling list under `parent_id` (root = `null`), applying the same
 * missing/self-parent → root normalization as `build_section_tree`. Used by the
 * reorder/nest ops to find a section's neighbours + compute fractional keys.
 */
export function ordered_children<T extends GrammarSectionLike>(rows: T[], parent_id: string | null): T[] {
  const by_id = new Map(rows.map(row => [row.id, row]))
  return rows
    .filter((row) => {
      const raw_parent = row.parent_id ?? null
      const normalized = raw_parent && raw_parent !== row.id && by_id.has(raw_parent) ? raw_parent : null
      return normalized === parent_id
    })
    .sort(compare_siblings)
}

/** Flatten a tree depth-first (pre-order) — the render order for a fully-expanded tree. */
export function flatten_tree<T extends GrammarSectionLike>(nodes: GrammarTreeNode<T>[]): GrammarTreeNode<T>[] {
  const out: GrammarTreeNode<T>[] = []
  for (const node of nodes) {
    out.push(node)
    out.push(...flatten_tree(node.children))
  }
  return out
}

/**
 * New `sort_key` to move a section one slot UP within its ordered sibling list
 * (jumping above the previous sibling). `null` when it's already first.
 */
export function move_up_key(ordered_sort_keys: string[], index: number): string | null {
  if (index <= 0 || index >= ordered_sort_keys.length)
    return null
  const before = index - 2 >= 0 ? ordered_sort_keys[index - 2] : null
  const after = ordered_sort_keys[index - 1]
  return key_between(before, after)
}

/**
 * New `sort_key` to move a section one slot DOWN within its ordered sibling
 * list (below the next sibling). `null` when it's already last.
 */
export function move_down_key(ordered_sort_keys: string[], index: number): string | null {
  if (index < 0 || index >= ordered_sort_keys.length - 1)
    return null
  const before = ordered_sort_keys[index + 1]
  const after = index + 2 < ordered_sort_keys.length ? ordered_sort_keys[index + 2] : null
  return key_between(before, after)
}

/** New `sort_key` appending a section as the LAST child of a parent (indent target). */
export function append_child_key(existing_child_sort_keys: string[]): string {
  const sorted = existing_child_sort_keys.slice().sort((first, second) => first.localeCompare(second))
  return key_between(sorted.length ? sorted[sorted.length - 1] : null, null)
}

/** New `sort_key` placing a section immediately AFTER `parent_sort_key` among the grandparent's children (outdent target). */
export function after_sibling_key(parent_sort_key: string, next_uncle_sort_key: string | null): string {
  return key_between(parent_sort_key, next_uncle_sort_key)
}
