import { describe, expect, test } from 'vitest'
import { convert_multistring, convert_value, create_conversion_stats } from './richtext'

describe(convert_value, () => {
  test('CKEditor HTML → markdown (underline → lossless span, structure survives)', () => {
    const stats = create_conversion_stats()
    const markdown = convert_value({
      value: '<p>Hello <strong>world</strong> &amp; <u>underlined</u></p><h2>Section</h2><ul><li>one</li><li>two</li></ul>',
      where: 'd1.about',
      stats,
    })
    expect(markdown).toBe('Hello **world** & [underlined]{.underline}\n\n## Section\n\n- one\n- two')
    expect(stats.converted).toBe(1)
    expect(stats.mismatches).toHaveLength(0)
  })

  test('grammar paradigm table survives as raw HTML block', () => {
    const stats = create_conversion_stats()
    const markdown = convert_value({
      value: '<figure class="table"><table><tbody><tr><td>ni-</td><td>1sg</td></tr></tbody></table></figure>',
      where: 'd1.grammar',
      stats,
    })
    expect(markdown).toContain('<table')
    expect(markdown).toContain('ni-')
    expect(stats.mismatches).toHaveLength(0)
  })

  test('oembed media embed becomes a plain link', () => {
    const stats = create_conversion_stats()
    const markdown = convert_value({
      value: '<p>watch:</p><figure class="media"><oembed url="https://youtu.be/abc123"></oembed></figure>',
      where: 'd1.about',
      stats,
    })
    expect(markdown).toContain('<https://youtu.be/abc123>') // autolink form — renders as a normal link
  })

  test('plain text passes through untouched', () => {
    const stats = create_conversion_stats()
    expect(convert_value({ value: 'just a note, 100% plain', where: 'x', stats })).toBe('just a note, 100% plain')
    expect(stats.passed_through).toBe(1)
    expect(stats.converted).toBe(0)
  })

  test('empty / whitespace-only HTML → null', () => {
    const stats = create_conversion_stats()
    expect(convert_value({ value: '  ', where: 'x', stats })).toBeNull()
    expect(convert_value({ value: '<p>&nbsp;</p>', where: 'x', stats })).toBeNull()
    expect(stats.emptied).toBe(2)
    expect(stats.mismatches).toHaveLength(0)
  })

  test('images keep their src; base64 data URIs survive', () => {
    const stats = create_conversion_stats()
    const markdown = convert_value({
      value: '<figure class="image"><img src="https://lh3.googleusercontent.com/abc=s500"></figure>',
      where: 'x',
      stats,
    })
    expect(markdown).toBe('![](https://lh3.googleusercontent.com/abc=s500)')
  })

  test('links survive as markdown links', () => {
    const stats = create_conversion_stats()
    const markdown = convert_value({ value: '<p>see <a href="https://example.com/page">the site</a></p>', where: 'x', stats })
    expect(markdown).toBe('see [the site](https://example.com/page)')
  })
})

describe(convert_multistring, () => {
  test('converts each locale independently, drops emptied locales', () => {
    const stats = create_conversion_stats()
    const result = convert_multistring({
      value: { en: '<p>a <em>note</em></p>', es: '', pt: 'plain', fr: '<p>&nbsp;</p>' },
      where: 'e1.notes',
      stats,
    })
    expect(result).toEqual({ en: 'a *note*', pt: 'plain' })
  })

  test('null/non-object → null', () => {
    const stats = create_conversion_stats()
    expect(convert_multistring({ value: null, where: 'x', stats })).toBeNull()
    expect(convert_multistring({ value: 'not-a-map', where: 'x', stats })).toBeNull()
  })
})
