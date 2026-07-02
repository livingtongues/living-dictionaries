// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import { html_to_markdown } from './html-to-markdown'
import { render_markdown_to_html } from './render'
import { looks_like_html, rich_text_display_html } from './html-era-shim'
import { create_markdown_extensions, get_editor_markdown } from './extensions'

/** Round-trip a markdown string through the editor (parse → serialize). */
function markdown_through_editor(markdown: string): string {
  const extensions = create_markdown_extensions()
  const editor = new Editor({ extensions, content: markdown })
  try {
    return get_editor_markdown(editor).trim()
  } finally {
    editor.destroy()
  }
}

describe(html_to_markdown, () => {
  test('round-trips headings, bold, and lists', () => {
    const md = html_to_markdown('<h2>Word order</h2><p><strong>Nahuatl</strong> is polysynthetic.</p><ul><li>subject</li><li>object</li></ul>')
    expect(md).toContain('## Word order')
    expect(md).toContain('**Nahuatl** is polysynthetic.')
    expect(md).toContain('- subject')
    expect(md).toContain('- object')
  })

  test('legacy <u> converts to the lossless [text]{.underline} span', () => {
    // single-letter phoneme highlighting (iipay-aa pattern) — mid-word span
    const md = html_to_markdown('<p>like English "e" in "m<u>e</u>n".</p>')
    expect(md).toBe('like English "e" in "m[e]{.underline}n".')
    expect(render_markdown_to_html(md)).toContain('m<span class="underline">e</span>n')
    expect(markdown_through_editor(md)).toBe(md)
  })

  test('run-in heading pattern <strong><u>label:</u></strong> keeps both marks', () => {
    const md = html_to_markdown('<p><strong><u>Sinónimos:</u></strong> vivienda, la;</p>')
    expect(md).toContain('[Sinónimos:]{.underline}')
    expect(md).toContain('**')
    const html = render_markdown_to_html(md)
    expect(html).toContain('<span class="underline">Sinónimos:</span>')
    expect(html).toContain('<strong>')
  })

  test('IDS boilerplate: italic+underline inside a link loses no text', () => {
    const source = '<p>imported from <a href="http://ids.clld.org/"><i><u>The</u></i><u> </u><i><u>Intercontinental Dictionary Series</u></i></a> (IDS) in 2023.</p>'
    const md = html_to_markdown(source)
    const html = render_markdown_to_html(md)
    const text_of = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, '')
    expect(text_of(html)).toBe(text_of(source))
    expect(md).toContain('](http://ids.clld.org/)')
  })

  test('drops text-align (CKEditor alignment plugin) leaving clean prose', () => {
    const md = html_to_markdown('<p style="text-align:center;">A centered dedication.</p>')
    expect(md.trim()).toBe('A centered dedication.')
  })

  test('CKEditor figure-wrapped image becomes a markdown image', () => {
    const md = html_to_markdown('<figure class="image"><img src="https://lh3.googleusercontent.com/abc=w1000"></figure>')
    expect(md).toContain('![](https://lh3.googleusercontent.com/abc=w1000)')
    expect(md).not.toContain('<figure')
  })

  test('italic notes content round-trips', () => {
    const md = html_to_markdown('<p>From elder speakers; <i>uncertain gloss</i>.</p>')
    expect(md.trim()).toBe('From elder speakers; *uncertain gloss*.')
  })

  test('blockquote round-trips', () => {
    const md = html_to_markdown('<blockquote><p>He said the word slowly.</p></blockquote>')
    expect(md).toContain('> He said the word slowly.')
  })

  test('returns empty for blank input', () => {
    expect(html_to_markdown('')).toBe('')
    expect(html_to_markdown('   ')).toBe('')
  })

  test('CKEditor table survives as cleaned raw HTML inside markdown', () => {
    const md = html_to_markdown('<figure class="table"><table><tbody><tr><td>ni-</td><td>1sg</td></tr><tr><td>ti-</td><td>2sg</td></tr></tbody></table></figure>')
    expect(md).toContain('<table')
    expect(md).toContain('ni-')
    expect(md).not.toContain('colgroup')
    expect(md).not.toContain('min-width')
    const html = render_markdown_to_html(md)
    expect(html).toContain('<table')
    expect(html).toContain('2sg')
    expect(markdown_through_editor(md)).toBe(md)
  })

  test('table with real colspan keeps it', () => {
    const md = html_to_markdown('<table><tbody><tr><td colspan="2">Paradigm</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>')
    expect(md).toContain('colspan="2"')
  })

  test('CKEditor small-caps span → pandoc span, renders back to span.smallcaps', () => {
    const md = html_to_markdown('<p>The <span style="font-variant:small-caps">Dogon</span> language.</p>')
    expect(md).toBe('The [Dogon]{.smallcaps} language.')
    const html = render_markdown_to_html(md)
    expect(html).toContain('<span class="smallcaps">Dogon</span>')
    // and it round-trips through the editor byte-stable
    expect(markdown_through_editor(md)).toBe(md)
  })

  test('converted markdown reloaded into the editor is byte-stable (no first-save churn)', () => {
    const md = html_to_markdown('<h2>About</h2><p>The <strong>Nahuatl</strong> dictionary, with <i>notes</i>.</p><ol><li>one</li><li>two</li></ol><figure class="image"><img src="https://lh3.googleusercontent.com/abc"></figure>')
    expect(markdown_through_editor(md)).toBe(md)
  })
})

describe(render_markdown_to_html, () => {
  test('renders headings, emphasis, lists, and images', () => {
    const html = render_markdown_to_html('## Grammar\n\n**Verbs** carry *affixes*.\n\n- one\n- two\n\n![](https://lh3.googleusercontent.com/abc)')
    expect(html).toContain('<h2>Grammar</h2>')
    expect(html).toContain('<strong>Verbs</strong>')
    expect(html).toContain('<em>affixes</em>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<img src="https://lh3.googleusercontent.com/abc"')
  })

  test('returns empty for blank input', () => {
    expect(render_markdown_to_html('')).toBe('')
    expect(render_markdown_to_html('  \n ')).toBe('')
  })

  test('is stable across a markdown→HTML→markdown loop (no churn)', () => {
    const md1 = html_to_markdown(render_markdown_to_html('The **Nahuatl** dictionary, *notes* and [links](https://x.com).'))
    const md2 = html_to_markdown(render_markdown_to_html(md1))
    expect(md2).toBe(md1)
  })
})

describe(looks_like_html, () => {
  test('CKEditor-era content is detected', () => {
    expect(looks_like_html('<p>hi</p>')).toBeTruthy()
    expect(looks_like_html('  <h2>Grammar</h2>')).toBeTruthy()
    expect(looks_like_html('<figure class="image"><img src="x"></figure>')).toBeTruthy()
  })

  test('markdown is not', () => {
    expect(looks_like_html('## Grammar\n\n**bold**')).toBeFalsy()
    expect(looks_like_html('plain notes')).toBeFalsy()
    expect(looks_like_html('')).toBeFalsy()
  })
})

describe(rich_text_display_html, () => {
  test('HTML-era content passes through untouched', () => {
    expect(rich_text_display_html('<p>legacy <strong>about</strong></p>')).toBe('<p>legacy <strong>about</strong></p>')
  })

  test('markdown renders to HTML', () => {
    expect(rich_text_display_html('**bold** note')).toContain('<strong>bold</strong>')
  })

  test('empty values render empty', () => {
    expect(rich_text_display_html('')).toBe('')
    expect(rich_text_display_html(undefined)).toBe('')
    expect(rich_text_display_html(null)).toBe('')
  })
})
