// Vitest stand-in for SvelteKit's `$app/state` `page` (aliased in the `reactive`
// vitest project). It's a real `$state` rune object, so tests — and the mock
// `goto` in `app-navigation.ts` — can reassign `page.url` and the store/component
// effects that read it re-run under `flushSync()`, exercising real reactivity.
export const page = $state({
  url: new URL('http://localhost:3000/'),
  params: {} as Record<string, string>,
  data: {} as Record<string, unknown>,
})

// Reset helper for test isolation — restores the page URL to a clean default.
export function reset_page(href = 'http://localhost:3000/') {
  page.url = new URL(href)
  page.params = {}
  page.data = {}
}
