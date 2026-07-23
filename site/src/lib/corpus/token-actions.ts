import type { SentenceToken } from '$lib/db/schemas/dictionary.types'

/**
 * Pure token-value transforms for human review actions — shared by the client
 * worker op (`dict-writes.ts` `set_token_link_local`) and the v1 server
 * endpoint so both surfaces apply IDENTICAL semantics. Gold IGT metadata
 * (gloss/morphemes) always survives.
 */

export type TokenLinkAction = 'confirm' | 'ignore' | 'unlink'

export function apply_token_action({ token, action, entry_id, sense_id }: {
  token: SentenceToken
  action: TokenLinkAction
  entry_id?: string
  sense_id?: string
}): SentenceToken {
  const base: SentenceToken = { form: token.form, start: token.start, end: token.end }
  if (token.gloss)
    base.gloss = token.gloss
  if (token.morphemes)
    base.morphemes = token.morphemes
  if (action === 'confirm') {
    if (!entry_id)
      throw new Error('apply_token_action: entry_id required to confirm')
    return { ...base, entry_id, ...(sense_id ? { sense_id } : {}), status: 'confirmed' }
  }
  if (action === 'ignore')
    return { ...base, status: 'ignored' }
  return base
}

if (import.meta.vitest) {
  describe(apply_token_action, () => {
    const token: SentenceToken = { form: 'nak', start: 0, end: 3, entry_id: 'e1', sense_id: 's1', status: 'confirmed', gloss: { en: 'water' } }

    test('confirm replaces link but keeps gold gloss', () => {
      expect(apply_token_action({ token, action: 'confirm', entry_id: 'e2' }))
        .toEqual({ form: 'nak', start: 0, end: 3, entry_id: 'e2', status: 'confirmed', gloss: { en: 'water' } })
    })

    test('confirm with sense carries sense_id', () => {
      expect(apply_token_action({ token: { form: 'a', start: 0, end: 1 }, action: 'confirm', entry_id: 'e1', sense_id: 's9' }))
        .toEqual({ form: 'a', start: 0, end: 1, entry_id: 'e1', sense_id: 's9', status: 'confirmed' })
    })

    test('confirm without entry_id throws', () => {
      expect(() => apply_token_action({ token, action: 'confirm' })).toThrow('entry_id required')
    })

    test('ignore drops link, keeps gloss/morphemes', () => {
      const glossed: SentenceToken = { form: 'ri', start: 0, end: 2, candidates: ['e1', 'e2'], morphemes: [{ form: 'ri' }] }
      expect(apply_token_action({ token: glossed, action: 'ignore' }))
        .toEqual({ form: 'ri', start: 0, end: 2, status: 'ignored', morphemes: [{ form: 'ri' }] })
    })

    test('unlink returns the bare token', () => {
      expect(apply_token_action({ token, action: 'unlink' }))
        .toEqual({ form: 'nak', start: 0, end: 3, gloss: { en: 'water' } })
    })
  })
}
