import { MINIMUM_ABOUT_LENGTH } from '$lib/constants'
import { render_markdown_to_html } from './render'
import { sanitize_rich_text } from './sanitize-rich-text'

export function about_plain_text(about: string | null | undefined): string {
  if (!about)
    return ''

  return sanitize_rich_text(render_markdown_to_html(about))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function about_has_meaningful_content(about: string | null | undefined): boolean {
  return about_plain_text(about).length >= MINIMUM_ABOUT_LENGTH
}

if (import.meta.vitest) {
  describe(about_has_meaningful_content, () => {
    it('requires at least the shared minimum of visible text', () => {
      expect(about_has_meaningful_content('a'.repeat(MINIMUM_ABOUT_LENGTH - 1))).toBe(false)
      expect(about_has_meaningful_content('a'.repeat(MINIMUM_ABOUT_LENGTH))).toBe(true)
    })

    it('does not count markdown syntax, HTML tags, or link destinations', () => {
      const thin_link = `[x](https://example.com/${'path/'.repeat(50)})`
      expect(thin_link.length).toBeGreaterThan(MINIMUM_ABOUT_LENGTH)
      expect(about_plain_text(`<strong>${thin_link}</strong>`)).toBe('x')
      expect(about_has_meaningful_content(`<strong>${thin_link}</strong>`)).toBe(false)
    })

    it('treats empty and markup-only values as empty', () => {
      expect(about_plain_text(null)).toBe('')
      expect(about_plain_text('<p> </p>')).toBe('')
      expect(about_has_meaningful_content('<p> </p>')).toBe(false)
    })
  })
}
