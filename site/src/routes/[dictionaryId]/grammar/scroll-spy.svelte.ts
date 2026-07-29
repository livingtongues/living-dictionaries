/**
 * Which grammar section is currently under the reader — drives the TOC's active
 * highlight, the active chapter's auto-expansion, and the mobile "you are here"
 * bar.
 *
 * Every landmark tags itself `data-grammar-anchor="<id>"`. On each scroll frame
 * we measure where those landmarks sit and take the LAST one (document order)
 * whose top has passed under the sticky chrome — i.e. the heading you are
 * currently reading beneath. Nesting works for free: a subsection's top comes
 * after its parent's, so the deepest one you've entered wins.
 *
 * The line each landmark is tested against is its OWN `scroll-margin-top` (plus
 * a small epsilon), which is the same line `scrollIntoView` parks it on — so a
 * TOC click and the spy can never disagree about which section you just landed
 * on, at any breakpoint, with no magic number to keep in sync with the CSS.
 *
 * This replaced an IntersectionObserver implementation that recorded each
 * landmark's above/below state from IO callbacks. IO with `threshold: 0` only
 * fires on VISIBILITY transitions, never on top-edge crossings, so a section
 * taller than the viewport (Ponca's pronunciation guide is 13KB of prose) kept
 * the `false` it was given when it first appeared at the viewport BOTTOM until
 * it scrolled entirely out the top — leaving the TOC blank, or highlighting the
 * previous chapter, for the whole time you were reading it.
 */

/** Slack below a landmark's scroll-margin line, so a jump lands INSIDE its target. */
const EPSILON_PX = 4

interface Landmark {
  id: string
  element: HTMLElement
  /** The landmark's own `scroll-margin-top`, in px — where a jump parks it. */
  line: number
}

export class GrammarScrollSpy {
  active_id = $state<string | null>(null)

  /** Svelte attachment for the element wrapping every `[data-grammar-anchor]`. */
  watch = (container: HTMLElement) => {
    let landmarks: Landmark[] = []
    let frame = 0

    const recompute = () => {
      frame = 0
      let found: string | null = null
      for (const { id, element, line } of landmarks) {
        if (element.getBoundingClientRect().top <= line + EPSILON_PX)
          found = id
      }
      this.active_id = found ?? landmarks[0]?.id ?? null
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(recompute)
    }

    // Reading `scroll-margin-top` per landmark is the expensive part, so it
    // happens here (on structural change / resize) rather than per frame.
    const rescan = () => {
      landmarks = [...container.querySelectorAll<HTMLElement>('[data-grammar-anchor]')]
        .map((element) => {
          const { grammarAnchor: id } = element.dataset
          if (!id) return null
          return { id, element, line: Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0 }
        })
        .filter((landmark): landmark is Landmark => !!landmark)
      recompute()
    }

    rescan()

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', rescan)

    // Sections appear as the dictionary DB loads and come and go while editing.
    // childList only — attribute churn (the TOC's own active class) must not
    // retrigger this.
    let rescan_frame = 0
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(rescan_frame)
      rescan_frame = requestAnimationFrame(rescan)
    })
    mutations.observe(container, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(rescan_frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', rescan)
      mutations.disconnect()
    }
  }
}

/**
 * Scroll a landmark into view under the sticky chrome. Returns false when the
 * landmark isn't in the DOM yet — the deep-link handler retries as the
 * dictionary DB streams sections in.
 */
export function scroll_to_anchor({ dom_id, smooth = true }: { dom_id: string, smooth?: boolean }): boolean {
  const element = document.getElementById(dom_id)
  if (!element) return false
  element.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' })
  return true
}
