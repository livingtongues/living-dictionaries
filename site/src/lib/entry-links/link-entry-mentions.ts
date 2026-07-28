import type { EntryLinkIndex } from './exact-lexeme-index'
import { find_entry_mentions } from './find-entry-mentions'

/**
 * Svelte attachment that turns dictionary-entry mentions inside already-rendered
 * prose into tappable words. Applied to the element holding an `{@html}` body
 * (grammar sections today; any rich text later).
 *
 * Render-time, not stored: nothing is written to the DB, no authoring syntax to
 * learn, and the links stay correct as entries are added or renamed. An
 * explicit stored override lane can layer on later — this pass simply skips
 * anything already wrapped in a link.
 *
 * The attachment re-runs whenever `html` or `index` changes (Svelte re-creates
 * an attachment when the expression producing it re-evaluates), so the
 * decorated DOM never outlives the markup it decorated.
 */

export const ENTRY_MENTION_CLASS = 'entry-mention'
/** Opt an element (and its subtree) out of linking. */
export const NO_LINK_CLASS = 'no-entry-links'

export interface EntryMentionClick {
  entry_ids: string[]
  form: string
  anchor: HTMLElement
}

/** Emphasis marks the author used to flag vernacular — unlocks short forms. */
const MARKED_TAGS = new Set(['STRONG', 'B', 'EM', 'I'])
/** Never rewrite inside these: existing links, code, or editable content. */
const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'BUTTON'])

function should_skip(node: Node, root: HTMLElement): boolean {
  let element = node.parentElement
  while (element && element !== root) {
    if (SKIP_TAGS.has(element.tagName)) return true
    if (element.classList.contains(NO_LINK_CLASS)) return true
    if (element.isContentEditable) return true
    element = element.parentElement
  }
  return false
}

function is_marked(node: Node, root: HTMLElement): boolean {
  let element = node.parentElement
  while (element && element !== root) {
    if (MARKED_TAGS.has(element.tagName)) return true
    element = element.parentElement
  }
  return false
}

export function link_entry_mentions({ index, html: _html, on_click }: {
  index: EntryLinkIndex | null
  /** The rendered markup — declared so the attachment re-runs when it changes. */
  html?: string
  on_click: (detail: EntryMentionClick) => void
}) {
  return (root: HTMLElement) => {
    if (!index?.by_form.size) return

    function decorate() {
      const texts: Text[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue?.trim() && !should_skip(node, root))
          texts.push(node as Text)
      }

      for (const text_node of texts) {
        const text = text_node.nodeValue ?? ''
        const mentions = find_entry_mentions({ text, index: index as EntryLinkIndex, marked: is_marked(text_node, root) })
        if (!mentions.length) continue

        const fragment = document.createDocumentFragment()
        let cursor = 0
        for (const mention of mentions) {
          if (mention.start > cursor)
            fragment.append(text.slice(cursor, mention.start))
          const mark = document.createElement('button')
          mark.type = 'button'
          mark.className = ENTRY_MENTION_CLASS
          mark.textContent = mention.form
          mark.dataset.entryIds = mention.entry_ids.join(' ')
          fragment.append(mark)
          cursor = mention.end
        }
        if (cursor < text.length)
          fragment.append(text.slice(cursor))
        text_node.replaceWith(fragment)
      }
    }

    // A frame late, deliberately: `{@html}` children are only settled once
    // Svelte has finished mounting (or HYDRATING) the subtree — rewriting them
    // synchronously inside the attachment races hydration, which then reclaims
    // the original text nodes and silently drops every link.
    const frame = requestAnimationFrame(decorate)

    const handle_click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(`.${ENTRY_MENTION_CLASS}`)
      if (!target || !root.contains(target)) return
      event.preventDefault()
      const entry_ids = (target.dataset.entryIds ?? '').split(' ').filter(Boolean)
      if (entry_ids.length)
        on_click({ entry_ids, form: target.textContent ?? '', anchor: target })
    }

    root.addEventListener('click', handle_click)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('click', handle_click)
    }
  }
}
