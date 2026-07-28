/**
 * Which grammar section is currently under the reader — drives the TOC's active
 * highlight, the active chapter's auto-expansion, and the mobile "you are here"
 * bar.
 *
 * Every landmark tags itself `data-grammar-anchor="<id>"`. An IntersectionObserver
 * with a negative top `rootMargin` puts a line just below the sticky chrome and
 * fires whenever a landmark crosses it; the callback records each landmark's
 * above/below state and the active one is simply the LAST landmark in document
 * order that sits above the line. That handles nesting for free (a subsection's
 * top comes after its parent's, so the deepest one you've entered wins) and
 * needs no scroll listener.
 */

/** Distance below the viewport top where a section counts as "entered" (sticky header + mobile bar). */
const DEFAULT_OFFSET_PX = 104

export class GrammarScrollSpy {
  active_id = $state<string | null>(null)
  #offset: number

  constructor(offset = DEFAULT_OFFSET_PX) {
    this.#offset = offset
  }

  /** Svelte attachment for the element wrapping every `[data-grammar-anchor]`. */
  watch = (container: HTMLElement) => {
    // Plain object, not a Map — this is internal bookkeeping read only inside
    // `recompute`, so it must NOT be reactive.
    let above: Record<string, boolean> = {}
    let anchors: HTMLElement[] = []
    let observer: IntersectionObserver | null = null

    const recompute = () => {
      let found: string | null = null
      for (const anchor of anchors) {
        const { grammarAnchor: id } = anchor.dataset
        if (id && above[id])
          found = id
      }
      this.active_id = found ?? anchors[0]?.dataset.grammarAnchor ?? null
    }

    const measure = (element: HTMLElement) => {
      const { grammarAnchor: id } = element.dataset
      if (id)
        above[id] = element.getBoundingClientRect().top <= this.#offset
    }

    const rescan = () => {
      observer?.disconnect()
      anchors = [...container.querySelectorAll<HTMLElement>('[data-grammar-anchor]')]
      above = {}
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries)
          measure(entry.target as HTMLElement)
        recompute()
      }, { rootMargin: `-${this.#offset}px 0px 0px 0px`, threshold: 0 })
      for (const anchor of anchors) {
        measure(anchor)
        observer.observe(anchor)
      }
      recompute()
    }

    rescan()

    // Sections appear as the dictionary DB loads and come and go while editing.
    let queued = 0
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(queued)
      queued = requestAnimationFrame(rescan)
    })
    mutations.observe(container, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(queued)
      mutations.disconnect()
      observer?.disconnect()
    }
  }
}

/** Smooth-scroll a landmark into view under the sticky chrome. */
export function scroll_to_anchor(dom_id: string) {
  const element = document.getElementById(dom_id)
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
