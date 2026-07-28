import type { EntryLinkIndex } from './exact-lexeme-index'
import { exact_form_key, is_linkable_key } from './exact-lexeme-index'

/**
 * Locate dictionary-entry mentions inside one run of authored text. Pure, so
 * the greedy phrase rules stay testable without a DOM; `link-entry-mentions.ts`
 * walks the rendered prose and applies this per text node.
 */

export interface EntryMention {
  /** Offsets into the supplied text. */
  start: number
  end: number
  /** The surface form as written (what stays visible on the page). */
  form: string
  /** Every entry sharing this written form — >1 means homographs. */
  entry_ids: string[]
}

const WORD_MATCH = /[\p{L}\p{M}\p{N}]+(?:['’ʻ-][\p{L}\p{M}\p{N}]+)*/gu

interface Word { start: number, end: number, key: string }

function words_of(text: string): Word[] {
  const words: Word[] = []
  for (const match of text.matchAll(WORD_MATCH)) {
    const key = exact_form_key(match[0])
    if (key) words.push({ start: match.index, end: match.index + match[0].length, key })
  }
  return words
}

/**
 * Longest-phrase-first scan. `marked` says the text sits inside an
 * author-emphasized span (bold/italic), which unlocks the short pure-ASCII
 * forms — see `is_linkable_key`.
 */
export function find_entry_mentions({ text, index, marked = false }: {
  text: string
  index: EntryLinkIndex
  marked?: boolean
}): EntryMention[] {
  const words = words_of(text)
  const mentions: EntryMention[] = []
  let position = 0
  while (position < words.length) {
    const max_n = Math.min(index.max_word_count, words.length - position)
    let matched = 0
    for (let n = max_n; n >= 1; n--) {
      const slice = words.slice(position, position + n)
      const key = slice.map(word => word.key).join(' ')
      const entry_ids = index.by_form.get(key)
      if (!entry_ids?.length) continue
      if (!is_linkable_key({ key, marked })) continue
      const [{ start }] = slice
      const { end } = slice[slice.length - 1]
      mentions.push({ start, end, form: text.slice(start, end), entry_ids: [...entry_ids] })
      matched = n
      break
    }
    position += matched || 1
  }
  return mentions
}

if (import.meta.vitest) {
  const index = {
    by_form: new Map([
      ['đihą́', ['e1']],
      ['gíđe', ['e2', 'e3']],
      ['đįgé gáxe', ['e4']],
      ['gáxe', ['e5']],
      ['a', ['e6']],
      ['nak', ['e7']],
    ]),
    max_word_count: 2,
  }

  describe(find_entry_mentions, () => {
    it('finds a diacritic form in plain prose', () => {
      const found = find_entry_mentions({ text: 'the verb Đihą́ ‘to lift’', index })
      expect(found).toHaveLength(1)
      expect(found[0].form).toBe('Đihą́')
      expect(found[0].entry_ids).toEqual(['e1'])
    })

    it('reports every homograph', () => {
      const [mention] = find_entry_mentions({ text: 'Gíđe is happy', index })
      expect(mention.entry_ids).toEqual(['e2', 'e3'])
    })

    it('prefers the longer phrase over its parts', () => {
      const found = find_entry_mentions({ text: 'say Đįgé gáxe here', index })
      expect(found).toHaveLength(1)
      expect(found[0].form).toBe('Đįgé gáxe')
    })

    it('still matches the single word when the phrase does not continue', () => {
      const found = find_entry_mentions({ text: 'just gáxe alone', index })
      expect(found.map(mention => mention.form)).toEqual(['gáxe'])
    })

    it('does NOT link a short ascii form in running prose', () => {
      expect(find_entry_mentions({ text: 'a lift for a verb', index })).toEqual([])
    })

    it('links that same form when the author marked it', () => {
      const found = find_entry_mentions({ text: 'a', index, marked: true })
      expect(found.map(mention => mention.form)).toEqual(['a'])
    })

    it('links longer ascii forms without marking', () => {
      expect(find_entry_mentions({ text: 'the nak word', index }).map(m => m.form)).toEqual(['nak'])
    })

    it('reports offsets that slice back to the form', () => {
      const text = 'we use Đihą́ often'
      const [mention] = find_entry_mentions({ text, index })
      expect(text.slice(mention.start, mention.end)).toBe('Đihą́')
    })
  })
}
