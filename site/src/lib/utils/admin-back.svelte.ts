import { afterNavigate, replaceState } from '$app/navigation'
import { page } from '$app/state'

export interface BackTarget {
  label: string
  url: string
}

interface Options {
  fallback: BackTarget
  /**
   * Map the previous URL's pathname to a back target. Return null to use the fallback.
   * Called only on fresh forward navigation; on popstate revisits the previously
   * saved back target is restored from history.state automatically.
   */
  compute: (from_path: string) => BackTarget | null
}

/**
 * Smart back-button state for an admin detail page.
 *
 * Solves the user↔thread loop that comes from re-computing back on every visit:
 * we persist the computed back target into history.state via SvelteKit's
 * replaceState, so popstate (browser back) restores the *original* back label
 * for that history entry, and `history.back()` walks the real browser stack.
 *
 * Usage:
 * ```svelte
 * const back = use_admin_back({
 *   fallback: { label: 'Back to inbox', url: '/admin/messages' },
 *   compute: (path) => path.startsWith('/admin/users/') ? { label: 'Back to user', url: path } : null,
 * })
 * ```
 * ```html
 * <a href={back.target.url} onclick={back.on_click}>{back.target.label}</a>
 * ```
 */
export function use_admin_back(options: Options) {
  let target = $state<BackTarget>(options.fallback)
  let has_history = $state(false)

  afterNavigate(({ from }) => {
    const saved = (page.state as { admin_back?: BackTarget }).admin_back
    if (saved) {
      target = saved
      has_history = true
      return
    }
    const path = from?.url.pathname ?? ''
    const computed = options.compute(path) ?? options.fallback
    target = computed
    has_history = !!from
    // Only persist into history.state when we got here from another in-app
    // page. On initial deep-link / refresh `from` is null, no history to
    // preserve, AND the SvelteKit router isn't initialized yet on first
    // afterNavigate — calling replaceState would throw.
    if (from)
      replaceState('', { ...page.state, admin_back: computed })
  })

  function on_click(event: MouseEvent) {
    // Let modifier/middle clicks open in new tab via the href
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)
      return
    // No prior in-app history (deep-link landing) — let the <a href> handle it
    if (!has_history)
      return
    event.preventDefault()
    history.back()
  }

  return {
    get target() { return target },
    on_click,
  }
}
