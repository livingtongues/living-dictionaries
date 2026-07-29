import type { GlossCatalog } from './gloss-catalog'

/**
 * Svelte attachment that lights up glossing codes inside already-rendered
 * prose — the twin of `link_entry_mentions`, and deliberately built the same
 * way (walk the text nodes of an `{@html}` body, wrap matches in buttons, let
 * the host own the popover).
 *
 * A grammar chapter is where codes are EXPLAINED, so `1SG` in a paradigm table
 * or a running sentence should expand exactly like the same code in an
 * interlinear gloss. Matching is token-boundary + case-sensitive (see
 * `gloss-catalog`'s `split_prose`) — the substring rule that gloss cells enjoy
 * would set fire to ordinary words.
 */

export const GLOSS_CODE_CLASS = 'gloss-code'
/** Opt an element (and its subtree) out — shared spelling with the entry-link pass. */
export const NO_GLOSS_CLASS = 'no-entry-links'

export interface GlossCodeClick {
  code: string
  anchor: HTMLElement
}

/** Never rewrite inside these: links, code samples, editable content, or another pass's buttons. */
const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'BUTTON'])

function should_skip(node: Node, root: HTMLElement): boolean {
  let element = node.parentElement
  while (element && element !== root) {
    if (SKIP_TAGS.has(element.tagName)) return true
    if (element.classList.contains(NO_GLOSS_CLASS)) return true
    if (element.isContentEditable) return true
    element = element.parentElement
  }
  return false
}

export function link_gloss_codes({ catalog, html: _html, on_click }: {
  catalog: GlossCatalog | null
  /** The rendered markup — declared so the attachment re-runs when it changes. */
  html?: string
  on_click: (detail: GlossCodeClick) => void
}) {
  return (root: HTMLElement) => {
    // A const copy so the null-check narrows inside `decorate` too.
    const active = catalog
    if (!active) return

    /** Every button this run created, so teardown can put the prose back. */
    const created: HTMLElement[] = []

    function decorate() {
      const texts: Text[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue?.trim() && !should_skip(node, root))
          texts.push(node as Text)
      }

      for (const text_node of texts) {
        const pieces = active.split_prose(text_node.nodeValue ?? '')
        if (!pieces.some(piece => piece.code)) continue

        const fragment = document.createDocumentFragment()
        for (const piece of pieces) {
          if (!piece.code) {
            fragment.append(piece.text)
            continue
          }
          const mark = document.createElement('button')
          mark.type = 'button'
          mark.className = GLOSS_CODE_CLASS
          mark.textContent = piece.text
          mark.dataset.glossCode = piece.code
          mark.title = active.expand(piece.code)
          fragment.append(mark)
          created.push(mark)
        }
        text_node.replaceWith(fragment)
      }
    }

    // A frame late, for the same reason as the entry-link pass: `{@html}`
    // children are only settled once Svelte has finished mounting (or
    // HYDRATING) the subtree — rewriting them synchronously races hydration,
    // which then reclaims the original text nodes and drops every button.
    const frame = requestAnimationFrame(decorate)

    const handle_click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(`.${GLOSS_CODE_CLASS}`)
      if (!target || !root.contains(target)) return
      event.preventDefault()
      const code = target.dataset.glossCode
      if (code)
        on_click({ code, anchor: target })
    }

    root.addEventListener('click', handle_click)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('click', handle_click)
      // Undo the decoration, because unlike the entry-link index the catalog is
      // never empty: the dictionary's own legend streams in AFTER the standard
      // one is already usable, and the reader can switch gloss language. Both
      // re-run this attachment, and a re-run walks TEXT nodes — anything left
      // wrapped in a button would keep its first, half-informed expansion.
      for (const mark of created) {
        const parent = mark.parentNode
        if (!parent) continue
        parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
        parent.normalize()
      }
      created.length = 0
    }
  }
}
