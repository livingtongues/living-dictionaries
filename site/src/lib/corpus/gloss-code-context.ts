import { getContext, setContext } from 'svelte'
import type { GlossCatalog } from './gloss-catalog'
import type { GlossCodeClick } from './link-gloss-codes'

/**
 * Shares the dictionary's gloss catalog + the single expansion popover with
 * whatever renders authored prose. Context rather than props because the
 * grammar section tree is recursive — every nesting level would otherwise have
 * to forward both. Mirrors `entry-links/mention-context`.
 */

const KEY = Symbol('gloss-codes')

export interface GlossCodeContext {
  readonly catalog: GlossCatalog | null
  open: (detail: GlossCodeClick) => void
}

export function set_gloss_code_context(context: GlossCodeContext) {
  setContext(KEY, context)
}

export function get_gloss_code_context(): GlossCodeContext | null {
  return getContext<GlossCodeContext | null>(KEY) ?? null
}
