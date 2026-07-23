import type { SentenceToken } from '$lib/db/schemas/dictionary.types'
import { is_punctuation_form } from './tokenize-sentence'

export type TokenKind = 'punct' | 'ignored' | 'auto' | 'confirmed' | 'ambiguous' | 'unmatched'

/** Review-state classification of a token — drives styling + popover content. */
export function token_kind(token: SentenceToken): TokenKind {
  if (token.status === 'ignored')
    return is_punctuation_form(token.form) ? 'punct' : 'ignored'
  if (token.status === 'confirmed')
    return 'confirmed'
  if (token.entry_id)
    return 'auto'
  if (token.candidates?.length)
    return 'ambiguous'
  return 'unmatched'
}

if (import.meta.vitest) {
  describe(token_kind, () => {
    test('classifies each state', () => {
      expect(token_kind({ form: '.', start: 0, end: 1, status: 'ignored' })).toBe('punct')
      expect(token_kind({ form: 'uh', start: 0, end: 2, status: 'ignored' })).toBe('ignored')
      expect(token_kind({ form: 'a', start: 0, end: 1, entry_id: 'e', status: 'confirmed' })).toBe('confirmed')
      expect(token_kind({ form: 'a', start: 0, end: 1, entry_id: 'e', status: 'auto' })).toBe('auto')
      expect(token_kind({ form: 'a', start: 0, end: 1, candidates: ['e1', 'e2'] })).toBe('ambiguous')
      expect(token_kind({ form: 'a', start: 0, end: 1 })).toBe('unmatched')
    })
  })
}
