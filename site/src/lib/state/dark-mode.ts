export type ColorScheme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'color_scheme'

export function get_color_scheme(): ColorScheme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark')
    return stored
  return 'system'
}

export function set_color_scheme(scheme: ColorScheme) {
  localStorage.setItem(STORAGE_KEY, scheme)
  apply_color_scheme(scheme)
}

export function init_color_scheme(): ColorScheme {
  const scheme = get_color_scheme()
  apply_color_scheme(scheme)
  return scheme
}

/**
 * The override class lives on <html> (NOT <body>): the canvas/overscroll paint,
 * the root scrollbar's color-scheme, and theme.css's `:root:not(.light)` media
 * exclusion all read the root element, so a body-level class would leave them
 * on the OS scheme whenever a user forces the opposite. A pre-paint inline
 * script in app.html applies the same class before first render (no flash of
 * the wrong theme) — keep the two in sync. This file is byte-identical in
 * tutor and living-dictionaries.
 */
function apply_color_scheme(scheme: ColorScheme) {
  document.documentElement.classList.remove('dark', 'light')
  if (scheme !== 'system')
    document.documentElement.classList.add(scheme)
}
