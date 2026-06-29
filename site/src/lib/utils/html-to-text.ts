/**
 * Strip a small subset of HTML to a readable plaintext fallback for emails.
 * Used by rich-text composers to populate `body_text` alongside `body_html` so
 * mail clients without HTML support (or scanners stripping HTML) still get a
 * legible message.
 *
 * Not a general-purpose sanitizer, but it IS fed untrusted inbound email HTML on
 * the notification + triage paths (marketing/phishing senders ship full HTML
 * documents), so it strips `<style>`/`<script>`/`<head>` blocks and comments up
 * front — otherwise their raw CSS/JS text content would leak through the
 * tag-stripping pass into ntfy snippets and the classifier context.
 */
export function html_to_text(html: string): string {
  return html
    // Drop blocks whose TEXT CONTENT would otherwise survive tag-stripping
    // (CSS rules, scripts, Outlook conditional comments, <head> meta/title).
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
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

    it('strips <style> blocks (untrusted inbound HTML) instead of leaking CSS', () => {
      expect(html_to_text('<style>.a{color:red} @media(max-width:600px){.b{display:none}}</style><p>Hi there</p>'))
        .toBe('Hi there')
    })

    it('strips <script> blocks instead of leaking JS', () => {
      expect(html_to_text('<script>var x = 1; alert(x)</script><p>Body</p>')).toBe('Body')
    })

    it('strips <head> contents and HTML comments', () => {
      expect(html_to_text('<head><title>Promo</title></head><!--[if mso]>junk<![endif]--><p>Real body</p>'))
        .toBe('Real body')
    })

    it('preserves heading text as a separate paragraph', () => {
      expect(html_to_text('<h2>Title</h2><p>Body</p>')).toBe('Title\n\nBody')
    })
  })
}
