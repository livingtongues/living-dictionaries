import { truncateAuthors } from './clipCitation';

// pulling examples from https://livingtongues.org/anderson-bibliography/
// most styles guides only invert the last name to the front for the first author for alphabetical reasons, after that we can rely on commas, 'and', and '&' to split things.

test('One author in citation', () =>
  expect(truncateAuthors('Anderson, Gregory D. S.')).toMatchInlineSnapshot('"Anderson, Gregory D. S., "'));

test('One author in citation with apostrophe in her/his name', () =>
  expect(truncateAuthors("O'Neal S.")).toMatchInlineSnapshot('"O\'Neal S., "'));

test('Two authors in citation below maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Anderson, Gregory D. S. and Opino Gomango.'))
    .toMatchInlineSnapshot('"Anderson, Gregory D. S. and Opino Gomango., "'));

test('Two authors in citation exceeding maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Derwing, Travis, & James the Great Rossiter'))
    .toMatchInlineSnapshot('"Derwing, Travis, & James the Great Rossiter, "'));

test('Authors in citation exceding maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Derwing, T., A. O. Summo, M G. Davids, & E. R. Timmo'))
    .toMatchInlineSnapshot('"Derwing, T., A. O. Summo, M G. Davids, et al., "'));

test('Authors in citation exceding maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Córdova D., A. O. Summo, M G. Davids, & Edward. R. Timmo'))
    .toMatchInlineSnapshot('"Córdova D., A. O. Summo, M G. Davids, et al., "'));

test('Handles undefined', () =>
  expect(truncateAuthors(undefined)).toMatchInlineSnapshot('""'));