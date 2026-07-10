import { browser } from '$app/environment'

// Reactive current color mode. The <html> class override (set by
// $lib/state/dark-mode.ts + the pre-paint script in app.html) wins over the
// system preference — same resolution order as theme.css.

const state = $state({ is_dark: false })

function compute_is_dark(): boolean {
  const html_classes = document.documentElement.classList
  if (html_classes.contains('dark')) return true
  if (html_classes.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

if (browser) {
  state.is_dark = compute_is_dark()
  const update = () => { state.is_dark = compute_is_dark() }
  new MutationObserver(update)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update)
}

export function is_dark_mode(): boolean {
  return state.is_dark
}
