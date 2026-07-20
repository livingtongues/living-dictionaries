import { page } from './app-state.svelte'

// Vitest stand-in for SvelteKit's `$app/navigation` `goto` (aliased in the
// `reactive` vitest project). It mimics a real client navigation: it updates the
// happy-dom `window.location`/history (what `QueryParamState` reads to build
// the next URL) AND the `$app/state` `page.url` `$state` (what the store's
// `$effect` tracks) — so a `goto` triggered by the store feeds back through real
// Svelte reactivity, letting tests catch a store↔URL feedback loop for real.

export interface NavigationCall {
  url: string
  options?: unknown
}

export const navigation_log: NavigationCall[] = []

export function reset_navigation(href = 'http://localhost:3000/') {
  navigation_log.length = 0
  window.history.replaceState({}, '', href)
  page.url = new URL(window.location.href)
}

export function goto(url: string, options?: unknown): Promise<void> {
  navigation_log.push({ url, options })
  const resolved = new URL(url, window.location.href)
  window.history.replaceState({}, '', resolved.href)
  page.url = new URL(window.location.href)
  return Promise.resolve()
}
