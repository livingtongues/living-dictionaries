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

function apply_color_scheme(scheme: ColorScheme) {
  document.body.classList.remove('dark', 'light')
  if (scheme !== 'system')
    document.body.classList.add(scheme)
}
