import type { MultiString } from '$lib/types'
import { render_markdown_to_html } from '$lib/markdown/render'

/** Up to `limit` gloss values in the dictionary's gloss-language order (other values as fallback). */
export function top_glosses({ glosses, gloss_languages, limit = 2 }: {
  glosses: MultiString | null | undefined
  gloss_languages: string[] | null | undefined
  limit?: number
}): string[] {
  if (!glosses)
    return []
  const ordered = gloss_languages || []
  const values = ordered.map(bcp => glosses[bcp]).filter(Boolean)
  for (const [bcp, value] of Object.entries(glosses)) {
    if (value && !ordered.includes(bcp))
      values.push(value)
  }
  return values.slice(0, limit)
}

/** Plain-text preview of a markdown field (rendered so escapes/syntax resolve, tags stripped, whitespace collapsed, ellipsized). */
export function text_snippet({ markdown, max_length = 240 }: { markdown: string | null | undefined, max_length?: number }): string | null {
  if (!markdown)
    return null
  const text = render_markdown_to_html(markdown)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s+(?<closer>[.,;:!?)\]])/g, '$<closer>')
    .replace(/(?<opener>[([])\s+/g, '$<opener>')
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
  describe(top_glosses, () => {
    it('prefers the dictionary gloss-language order, capped at limit', () => {
      expect(top_glosses({ glosses: { es: 'manzana', en: 'apple', fr: 'pomme' }, gloss_languages: ['en', 'es', 'fr'] })).toEqual(['apple', 'manzana'])
    })
    it('falls back to values outside the gloss languages', () => {
      expect(top_glosses({ glosses: { fr: 'pomme' }, gloss_languages: ['en'] })).toEqual(['pomme'])
    })
    it('handles empty', () => {
      expect(top_glosses({ glosses: null, gloss_languages: ['en'] })).toEqual([])
      expect(top_glosses({ glosses: {}, gloss_languages: ['en'] })).toEqual([])
    })
  })

  describe(text_snippet, () => {
    it('strips tags and collapses whitespace', () => {
      expect(text_snippet({ markdown: '<p>Hello <i>world</i>.</p>\n\n<p>More.</p>' })).toBe('Hello world. More.')
    })
    it('resolves markdown escapes and syntax instead of bleeding them through', () => {
      expect(text_snippet({ markdown: String.raw`Gta? \[gaq\] is *also* known as **Didey**.` })).toBe('Gta? [gaq] is also known as Didey.')
      expect(text_snippet({ markdown: 'known as (**Didayi**) here' })).toBe('known as (Didayi) here')
    })
    it('ellipsizes long text at a word boundary', () => {
      const long = 'word '.repeat(100)
      const snippet = text_snippet({ markdown: long, max_length: 50 })
      expect(snippet.endsWith('…')).toBe(true)
      expect(snippet.length).toBeLessThanOrEqual(52)
    })
    it('returns null for empty/markup-only input', () => {
      expect(text_snippet({ markdown: null })).toBe(null)
      expect(text_snippet({ markdown: '<p> </p>' })).toBe(null)
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
