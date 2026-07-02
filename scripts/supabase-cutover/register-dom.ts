import { Window } from 'happy-dom'

/**
 * Give the tsx process the browser globals the Tiptap HTML→markdown pass needs
 * (`@tiptap/html generateJSON` + a headless prosemirror Editor). Mirrors what
 * vitest's `environment: 'happy-dom'` provides, hand-rolled for plain tsx.
 * Idempotent — safe to import from multiple entry points.
 */

const GLOBAL_KEYS = [
  'document',
  'navigator',
  'DOMParser',
  'XMLSerializer',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Text',
  'Comment',
  'DocumentFragment',
  'HTMLCollection',
  'NodeList',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'InputEvent',
  'ClipboardEvent',
  'DragEvent',
  'Range',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const

export function register_dom(): void {
  const globals = globalThis as Record<string, any>
  if (globals.__happy_dom_registered)
    return
  assign_window(globals)
  globals.__happy_dom_registered = true
}

/**
 * Swap in a FRESH happy-dom Window, releasing the old one's object graph.
 * happy-dom retains every parsed document/element reachable from the window
 * (measured 2026-07-02: ~750KB retained per html_to_markdown call → OOM at
 * ~2.5k conversions), so the cutover conversion calls this periodically.
 */
export function refresh_dom(): void {
  const globals = globalThis as Record<string, any>
  const old_window = globals.window
  try {
    old_window?.happyDOM?.close?.()
  } catch { /* best-effort */ }
  assign_window(globals)
}

function assign_window(globals: Record<string, any>): void {
  const window = new Window({ url: 'https://livingdictionaries.app' })
  globals.window = window
  for (const key of GLOBAL_KEYS) {
    const value = (window as any)[key]
    if (value === undefined)
      continue
    try {
      globals[key] = typeof value === 'function' && key === 'getComputedStyle' ? value.bind(window) : value
    } catch {
      // getter-only node built-in (e.g. `navigator` on node ≥21) — keep it
    }
  }
}
