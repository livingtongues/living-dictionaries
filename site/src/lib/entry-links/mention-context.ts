import { getContext, setContext } from 'svelte'
import type { EntryLinkIndex } from './exact-lexeme-index'
import type { EntryMentionClick } from './link-entry-mentions'

/**
 * Shares the lexeme index + the single popover opener with whatever renders
 * authored prose. Context rather than props because the grammar section tree is
 * recursive — every nesting level would otherwise have to forward both.
 */

const KEY = Symbol('entry-mentions')

export interface EntryMentionContext {
  readonly index: EntryLinkIndex | null
  open: (detail: EntryMentionClick) => void
}

export function set_entry_mention_context(context: EntryMentionContext) {
  setContext(KEY, context)
}

export function get_entry_mention_context(): EntryMentionContext | null {
  return getContext<EntryMentionContext | null>(KEY) ?? null
}
