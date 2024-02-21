import { sliceUrl } from './scrollPoint';

test('sliceUrl removes entry id', () => {
  expect(
    sliceUrl('my_dictionary/entry/123'),
  ).toMatchInlineSnapshot('"my_dictionary/entry"')
});

