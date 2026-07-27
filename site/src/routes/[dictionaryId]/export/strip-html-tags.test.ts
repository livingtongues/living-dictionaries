import { strip_html_tags } from './strip-html-tags'

test('simple text wrapped in HTML tags', () =>
  expect(strip_html_tags('<strong>test</strong>')).toBe('test'))

test('simple text wrapped in HTML tags with styles', () =>
  expect(
    strip_html_tags(
      '<p><strong>testing </strong><i><strong>just </strong></i><span style="font-variant:small-caps;"><strong>testing</strong></span></p>',
    ),
  ).toBe('testing just testing'))

test('complex HTML tags wrap text around', () =>
  expect(
    strip_html_tags(
      '<figure class="table"><table><tbody><tr><td>d</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>d</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>d</td></tr></tbody></table></figure>',
    ),
  ).toBe('d d d'))

test('real rich text example', () =>
  expect(
    strip_html_tags(
      '<p><strong>I</strong> <i>just</i> <u>want</u> <span style=\'font-variant:small-caps;\'>to</span> <a href=\'https://example.com\'>test</a></p>',
    ),
  ).toBe('I just want to test'))

test('does not remove commas', () => {
  expect(strip_html_tags('Something normal, with a comma')).toMatchInlineSnapshot(
    '"Something normal, with a comma"',
  )
})

test('returns empty string when undefined', () => {
  expect(strip_html_tags(undefined)).toMatchInlineSnapshot(
    '""',
  )
})
