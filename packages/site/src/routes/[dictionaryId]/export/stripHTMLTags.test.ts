import { stripHTMLTags } from './stripHTMLTags'

test('simple text wrapped in HTML tags', () =>
  expect(stripHTMLTags('<strong>test</strong>')).toBe('test'))

test('simple text wrapped in HTML tags with styles', () =>
  expect(
    stripHTMLTags(
      '<p><strong>testing </strong><i><strong>just </strong></i><span style="font-variant:small-caps;"><strong>testing</strong></span></p>',
    ),
  ).toBe('testing just testing'))

test('complex HTML tags wrap text around', () =>
  expect(
    stripHTMLTags(
      '<figure class="table"><table><tbody><tr><td>d</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>d</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>d</td></tr></tbody></table></figure>',
    ),
  ).toBe('d d d'))

test('real rich text example', () =>
  expect(
    stripHTMLTags(
      '<p><strong>I</strong> <i>just</i> <u>want</u> <span style=\'font-variant:small-caps;\'>to</span> <a href=\'https://example.com\'>test</a></p>',
    ),
  ).toBe('I just want to test'))

test('does not remove commas', () => {
  expect(stripHTMLTags('Something normal, with a comma')).toMatchInlineSnapshot(
    '"Something normal, with a comma"',
  )
})

test('returns empty string when undefined', () => {
  expect(stripHTMLTags(undefined)).toMatchInlineSnapshot(
    '""',
  )
})
