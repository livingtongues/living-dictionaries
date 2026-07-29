import { replaceState } from '$app/navigation'
import { page } from '$app/state'

/**
 * The grammar page keeps the landmark you are reading in the URL hash, so the
 * address bar is always a shareable deep link.
 *
 * REPLACE rather than push: a TOC is used many times per read, and burying the
 * route you arrived from under 20 hash entries makes Back useless. Every call is
 * wrapped because svelte-look mounts components WITHOUT a SvelteKit router, and
 * `$app/navigation`'s `replaceState` throws there (native `history.replaceState`
 * is not an option — SvelteKit dev-warns on it).
 */

export function write_section_hash(dom_id: string) {
  try {
    replaceState(`#${dom_id}`, page.state)
  } catch (_no_router) { /* no router (svelte-look) */ }
}

/** Drop the hash — you are back at the top, not inside any section. */
export function clear_section_hash() {
  try {
    replaceState(`${page.url.pathname}${page.url.search}`, page.state)
  } catch (_no_router) { /* no router (svelte-look) */ }
}
