const url_regex = /(((https?:\/\/)|(www\.))[^\s>]+\w\/?)/

export function prepare_display(s: string): string {
  if (url_regex.test(s)) {
    return s.replace(/https?:\/\//, '')
  }
  return s
}

export function prepare_href(s: string | undefined | null): string | null {
  const match = s?.match(url_regex)
  if (match?.length) {
    return match[0].replace(/^www\./, 'http://')
  }
  return null
}

if (import.meta.vitest) {
  test('prepare_href finds urls starting with https://, http://, and www.', () => {
    expect(prepare_href('https://google.com')).toMatchInlineSnapshot('"https://google.com"')
    expect(prepare_href('http://google.com')).toMatchInlineSnapshot('"http://google.com"')
    expect(prepare_href('www.google.com')).toMatchInlineSnapshot('"http://google.com"')
  })
  test('prepare_href handles urls inside strings, inside brackets, and returns 1st url if 2 found', () => {
    expect(prepare_href('Source: <https://creativecommons.org/licenses/by-sa/2.5>, via Wikimedia Commons, http://google.com')).toMatchInlineSnapshot('"https://creativecommons.org/licenses/by-sa/2.5"')
  })
  test('prepare_href does not capture non alpahnumeric characters at the end of the url except slash (avoids punctuation)', () => {
    expect(prepare_href('Here is a good site, https://example.com, and you should vist.')).toMatchInlineSnapshot('"https://example.com"')
    expect(prepare_href('How does this look https://example.com/?')).toMatchInlineSnapshot('"https://example.com/"')
    expect(prepare_href('https://example.com.,?')).toMatchInlineSnapshot('"https://example.com"')
  })
  test('prepare_href handles no match and undefined', () => {
    expect(prepare_href('Foo')).toMatchInlineSnapshot('null')
    expect(prepare_href(undefined)).toMatchInlineSnapshot('null')
  })
  test('prepare_display handles no match', () => {
    expect(prepare_display('Foo')).toMatchInlineSnapshot('"Foo"')
    expect(prepare_display(undefined)).toMatchInlineSnapshot('undefined')
  })
  test('prepare_display is stable across repeated calls', () => {
    expect([prepare_display('https://example.com'), prepare_display('https://example.com')]).toEqual(['example.com', 'example.com'])
  })
}
