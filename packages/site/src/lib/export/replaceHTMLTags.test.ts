import { replaceHTMLTags } from './replaceHTMLTags';

test('Simple text wrapped in HTML tags', () =>
  expect(replaceHTMLTags('<strong>test</strong>')).toBe('test'));

test('Simple text wrapped in HTML tags with styles', () =>
  expect(
    replaceHTMLTags(
      '<p><strong>testing </strong><i><strong>just </strong></i><span style="font-variant:small-caps;"><strong>testing</strong></span></p>'
    )
  ).toBe('testing just testing'));

test('complex HTML tags wrap text around', () =>
  expect(
    replaceHTMLTags(
      '<figure class="table"><table><tbody><tr><td>d</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>d</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>d</td></tr></tbody></table></figure>'
    )
  ).toBe('d d d'));

test('real rich text example', () =>
  expect(
    replaceHTMLTags(
      "<p><strong>I</strong> <i>just</i> <u>want</u> <span style='font-variant:small-caps;'>to</span> <a href='https://example.com'>test</a></p>"
    )
  ).toBe('I just want to test'));
