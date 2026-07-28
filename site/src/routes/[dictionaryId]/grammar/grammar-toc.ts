import type { GrammarSectionLike, GrammarTreeNode } from './grammar-tree'
import { first_multistring_value, has_title } from './grammar-tree'

/**
 * Derivation for the grammar page's table of contents. A long grammar (Ponca:
 * 59 sections, 77KB of prose) is unnavigable without one.
 *
 * Shape: top-level TITLED sections are the chapters; the ACTIVE chapter alone
 * expands to show its subsections. Untitled prefaces are skipped — they sit at
 * the very top of the page anyway, and "Untitled section" is not a jump target
 * anyone wants. Kept pure so the expansion + active-ancestor rules are testable
 * without a DOM.
 */

export interface TocEntry {
  /** The scroll-spy id — a `grammar_sections.id`, or a literal anchor for the pinned entries. */
  id: string
  /** The element id to jump to. */
  dom_id: string
  label: string
  /** '' for the pinned clause-template / legend entries. */
  number: string
  depth: 0 | 1
  is_active: boolean
}

export const CLAUSE_TEMPLATE_ANCHOR = 'grammar-clause-template'
export const GLOSSING_LEGEND_ANCHOR = 'grammar-glossing-legend'

/** The element id a section renders with (also what `ClauseTemplateStrip` links to). */
export function section_dom_id(section_id: string): string {
  return `section-${section_id}`
}

function label_for<T extends GrammarSectionLike>(node: GrammarTreeNode<T>, prefer: string[]): string {
  return first_multistring_value(node.section.title, prefer)
}

/**
 * The top-level titled section that contains `active_id` (or is it). `null`
 * when nothing is active or the active id isn't in the tree.
 */
export function active_chapter_id<T extends GrammarSectionLike>({ tree, active_id }: {
  tree: GrammarTreeNode<T>[]
  active_id: string | null
}): string | null {
  if (!active_id) return null
  for (const chapter of tree) {
    if (chapter.section.id === active_id) return chapter.section.id
    const found = chapter.children.some(child => contains_id(child, active_id))
    if (found) return chapter.section.id
  }
  return null
}

function contains_id<T extends GrammarSectionLike>(node: GrammarTreeNode<T>, id: string): boolean {
  return node.section.id === id || node.children.some(child => contains_id(child, id))
}

/**
 * The flat, render-ready entry list: chapters, with the active chapter's
 * subsections spliced in beneath it. `clause_template` / `glossing_legend` pin
 * the two non-section landmarks to the top and bottom.
 */
export function build_toc_entries<T extends GrammarSectionLike>({
  tree,
  active_id,
  prefer_languages = [],
  clause_template_label = '',
  glossing_legend_label = '',
}: {
  tree: GrammarTreeNode<T>[]
  active_id: string | null
  prefer_languages?: string[]
  /** Pass '' to omit the pinned clause-template entry. */
  clause_template_label?: string
  /** Pass '' to omit the pinned glossing-legend entry. */
  glossing_legend_label?: string
}): TocEntry[] {
  const chapter_id = active_chapter_id({ tree, active_id })
  const entries: TocEntry[] = []

  if (clause_template_label) {
    entries.push({
      id: CLAUSE_TEMPLATE_ANCHOR,
      dom_id: CLAUSE_TEMPLATE_ANCHOR,
      label: clause_template_label,
      number: '',
      depth: 0,
      is_active: active_id === CLAUSE_TEMPLATE_ANCHOR,
    })
  }

  for (const chapter of tree) {
    if (!has_title(chapter.section)) continue
    const is_open = chapter.section.id === chapter_id
    entries.push({
      id: chapter.section.id,
      dom_id: section_dom_id(chapter.section.id),
      label: label_for(chapter, prefer_languages),
      number: chapter.number,
      depth: 0,
      is_active: chapter.section.id === active_id,
    })
    if (!is_open) continue
    for (const child of chapter.children) {
      if (!has_title(child.section)) continue
      entries.push({
        id: child.section.id,
        dom_id: section_dom_id(child.section.id),
        label: label_for(child, prefer_languages),
        number: child.number,
        depth: 1,
        is_active: child.section.id === active_id,
      })
    }
  }

  if (glossing_legend_label) {
    entries.push({
      id: GLOSSING_LEGEND_ANCHOR,
      dom_id: GLOSSING_LEGEND_ANCHOR,
      label: glossing_legend_label,
      number: '',
      depth: 0,
      is_active: active_id === GLOSSING_LEGEND_ANCHOR,
    })
  }

  return entries
}

/**
 * What the mobile "you are here" bar shows. Prefers the deepest active section,
 * falling back to its chapter so the bar is never blank mid-scroll.
 */
export function active_breadcrumb<T extends GrammarSectionLike>({ tree, active_id, prefer_languages = [] }: {
  tree: GrammarTreeNode<T>[]
  active_id: string | null
  prefer_languages?: string[]
}): { number: string, label: string } | null {
  if (!active_id) return null
  const stack: GrammarTreeNode<T>[] = [...tree]
  while (stack.length) {
    const node = stack.shift()
    if (!node) break
    if (node.section.id === active_id && has_title(node.section))
      return { number: node.number, label: label_for(node, prefer_languages) }
    stack.push(...node.children)
  }
  const chapter_id = active_chapter_id({ tree, active_id })
  const chapter = tree.find(node => node.section.id === chapter_id)
  if (chapter && has_title(chapter.section))
    return { number: chapter.number, label: label_for(chapter, prefer_languages) }
  return null
}
