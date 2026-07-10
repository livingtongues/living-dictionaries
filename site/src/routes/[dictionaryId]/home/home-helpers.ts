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

/**
 * Height to request from the static-map proxy so the image's aspect matches the
 * rendered box and `object-fit: cover` never crops away fitted markers (a solo
 * full-width map panel is far wider than the paired 12/7 cell). Quantized to
 * 40px steps so window resizes don't fragment the 30-day server-side Mapbox
 * cache; clamped inside the proxy's 50-1280 bounds.
 */
export function static_map_height({ box_width, box_height, static_width = 480 }: {
  box_width: number
  box_height: number
  static_width?: number
}): number {
  if (!box_width || !box_height)
    return 280
  const height = Math.round((static_width * box_height) / box_width / 40) * 40
  return Math.min(480, Math.max(120, height))
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

  describe(static_map_height, () => {
    it('matches the paired 12/7 cell (~same as the old fixed 480x280)', () => {
      expect(static_map_height({ box_width: 480, box_height: 280 })).toBe(280)
    })
    it('flattens for a solo full-width panel capped at 20rem tall', () => {
      expect(static_map_height({ box_width: 1200, box_height: 320 })).toBe(120)
    })
    it('quantizes to 40px steps and clamps to 120-480', () => {
      expect(static_map_height({ box_width: 900, box_height: 320 })).toBe(160)
      expect(static_map_height({ box_width: 100, box_height: 900 })).toBe(480)
      expect(static_map_height({ box_width: 2000, box_height: 100 })).toBe(120)
    })
    it('falls back to 280 before the box is measured', () => {
      expect(static_map_height({ box_width: 0, box_height: 0 })).toBe(280)
    })
  })
}
