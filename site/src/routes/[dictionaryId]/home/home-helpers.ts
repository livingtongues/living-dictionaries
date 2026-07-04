import type { MultiString } from '$lib/types'

/** First gloss value in the dictionary's gloss-language order (any value as fallback). */
export function first_gloss({ glosses, gloss_languages }: {
  glosses: MultiString | null | undefined
  gloss_languages: string[] | null | undefined
}): string | null {
  if (!glosses)
    return null
  for (const bcp of gloss_languages || []) {
    if (glosses[bcp])
      return glosses[bcp]
  }
  return Object.values(glosses).find(Boolean) ?? null
}

/** Plain-text preview of a rich-text field (tags stripped, whitespace collapsed, ellipsized). */
export function text_snippet({ html, max_length = 240 }: { html: string | null | undefined, max_length?: number }): string | null {
  if (!html)
    return null
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
  if (!text)
    return null
  if (text.length <= max_length)
    return text
  const cut = text.slice(0, max_length)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max_length - 20))}…`
}

/** Deterministic hue (0-359) for photo-less card backgrounds — stable per entry. */
export function card_hue(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) % 360
  return hash
}

if (import.meta.vitest) {
  describe(first_gloss, () => {
    it('prefers the dictionary gloss-language order', () => {
      expect(first_gloss({ glosses: { es: 'manzana', en: 'apple' }, gloss_languages: ['en', 'es'] })).toBe('apple')
    })
    it('falls back to any value', () => {
      expect(first_gloss({ glosses: { fr: 'pomme' }, gloss_languages: ['en'] })).toBe('pomme')
    })
    it('handles empty', () => {
      expect(first_gloss({ glosses: null, gloss_languages: ['en'] })).toBe(null)
      expect(first_gloss({ glosses: {}, gloss_languages: ['en'] })).toBe(null)
    })
  })

  describe(text_snippet, () => {
    it('strips tags and collapses whitespace', () => {
      expect(text_snippet({ html: '<p>Hello <i>world</i>.</p>\n<p>More.</p>' })).toBe('Hello world. More.')
    })
    it('ellipsizes long text at a word boundary', () => {
      const long = 'word '.repeat(100)
      const snippet = text_snippet({ html: long, max_length: 50 })
      expect(snippet.endsWith('…')).toBe(true)
      expect(snippet.length).toBeLessThanOrEqual(52)
    })
    it('returns null for empty/markup-only input', () => {
      expect(text_snippet({ html: null })).toBe(null)
      expect(text_snippet({ html: '<p> </p>' })).toBe(null)
    })
  })

  describe(card_hue, () => {
    it('is deterministic and in range', () => {
      expect(card_hue('abc')).toBe(card_hue('abc'))
      expect(card_hue('xyz')).toBeGreaterThanOrEqual(0)
      expect(card_hue('xyz')).toBeLessThan(360)
    })
  })
}
