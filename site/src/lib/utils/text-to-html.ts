/**
 * Convert plain text (e.g. an agent draft reply with `\n` line breaks) into the
 * simple HTML the rich-text editor / email body expects. Escapes HTML, turns
 * blank-line-separated blocks into `<p>` and single newlines into `<br>`.
 */
export function text_to_html(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

if (import.meta.vitest) {
  test('wraps blocks in paragraphs and converts single newlines to br', () => {
    expect(text_to_html('Hi there,\nLine two\n\nSecond para'))
      .toBe('<p>Hi there,<br>Line two</p><p>Second para</p>')
  })

  test('escapes html special chars', () => {
    expect(text_to_html('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>')
  })
}
