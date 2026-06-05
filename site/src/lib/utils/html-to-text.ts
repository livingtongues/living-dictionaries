/**
 * Strip a small subset of HTML to a readable plaintext fallback for emails.
 * Used by rich-text composers to populate `body_text` alongside `body_html` so
 * mail clients without HTML support (or scanners stripping HTML) still get a
 * legible message.
 *
 * Not a general-purpose sanitizer — assumes input is already
 * TipTap-generated HTML (no scripts, no exotic constructs).
 */
export function html_to_text(html: string): string {
  return html
    // Block-level tags become double newlines so paragraphs separate visually.
    .replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, '\n\n')
    // <br> → single newline
    .replace(/<br\s*(?:\/\s*)?>/gi, '\n')
    // Anchor tags: "text (href)" — preserve the URL for mail clients without HTML.
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => {
      const inner = strip_remaining_tags(text).trim()
      if (!inner)
        return href
      if (inner === href)
        return href
      return `${inner} (${href})`
    })
    // Remaining tags drop without trace.
    .replace(/<[^>]+>/g, '')
    // Decode the small set of named entities TipTap output uses.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    // Collapse 3+ blank lines down to 2.
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function strip_remaining_tags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

if (import.meta.vitest) {
  describe(html_to_text, () => {
    it('collapses paragraph tags into double newlines', () => {
      expect(html_to_text('<p>One</p><p>Two</p>')).toBe('One\n\nTwo')
    })

    it('converts <br> to single newlines', () => {
      expect(html_to_text('<p>One<br>Two</p>')).toBe('One\nTwo')
    })

    it('strips bold/italic/strong/em marks transparently', () => {
      expect(html_to_text('<p>This is <strong>bold</strong> and <em>italic</em>.</p>'))
        .toBe('This is bold and italic.')
    })

    it('renders links as "text (href)" when text and href differ', () => {
      expect(html_to_text('<p>Click <a href="https://hvsb.app/x">here</a> please</p>'))
        .toBe('Click here (https://hvsb.app/x) please')
    })

    it('renders bare-URL links as just the URL', () => {
      expect(html_to_text('<p><a href="https://hvsb.app">https://hvsb.app</a></p>'))
        .toBe('https://hvsb.app')
    })

    it('renders empty-text links as the URL', () => {
      expect(html_to_text('<p><a href="https://hvsb.app"></a></p>'))
        .toBe('https://hvsb.app')
    })

    it('decodes common HTML entities', () => {
      expect(html_to_text('<p>Tom &amp; Jerry &lt;3 &quot;quotes&quot;</p>'))
        .toBe('Tom & Jerry <3 "quotes"')
    })

    it('separates list items into their own lines', () => {
      expect(html_to_text('<ul><li>One</li><li>Two</li><li>Three</li></ul>'))
        .toBe('One\n\nTwo\n\nThree')
    })

    it('collapses runs of empty paragraphs', () => {
      expect(html_to_text('<p>One</p><p></p><p></p><p>Two</p>'))
        .toBe('One\n\nTwo')
    })

    it('returns empty string for the empty-paragraph editor state', () => {
      expect(html_to_text('<p></p>')).toBe('')
    })

    it('preserves heading text as a separate paragraph', () => {
      expect(html_to_text('<h2>Title</h2><p>Body</p>')).toBe('Title\n\nBody')
    })
  })
}
