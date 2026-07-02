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

  test('drops underline but keeps the link (legacy CKEditor underlined link text)', () => {
    const md = html_to_markdown('<p>See <a href="https://livingdictionaries.app/tutorials"><u>the tutorials</u></a> first.</p>')
    expect(md).toContain('[the tutorials](https://livingdictionaries.app/tutorials)')
    expect(md).not.toContain('<u>')
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
