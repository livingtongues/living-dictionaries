import { truncateAuthors } from './truncateAuthors';

// pulling examples from https://livingtongues.org/anderson-bibliography/
// most styles guides only invert the last name to the front for the first author for alphabetical reasons, after that we can rely on commas, 'and', and '&' to split authors.

test('truncateAuthors just adds a comma after 1 author', () =>
  expect(truncateAuthors('Anderson, Gregory D. S.'))
    .toMatchInlineSnapshot('"Anderson, Gregory D. S., "'));

test('truncateAuthors leaves alone 2 authors below maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Anderson, Gregory D. S. and Opino Gomango.'))
    .toMatchInlineSnapshot('"Anderson, Gregory D. S. and Opino Gomango., "'));

test('truncateAuthors shortens 3 authors using an and exceeding maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Derwing, Travis, Jamison Adler and James the Great Rossiter'))
    .toMatchInlineSnapshot('"Derwing, Travis, Jamison Adler, et al., "'));

test('truncateAuthors shortens 3 authors using an ampersand exceeding maxLengthLookingGoodInLetter', () =>
  expect(truncateAuthors('Córdova, D., T. Derwing , A. O. Summo, M G. Davids, & E. R. Timmo'))
    .toMatchInlineSnapshot('"Córdova, D., T. Derwing , A. O. Summo, et al., "'));

test('truncateAuthors does not add an extra comma when maxLengthLookingGoodInLetter lands at an intersection of a comma plus ampersand', () =>
  expect(truncateAuthors('Córdova, D., A. O. Summo, M G. Davids, & Edward. R. Timmo'))
    .toMatchInlineSnapshot('"Córdova, D., A. O. Summo, M G. Davids, et al., "'));

test('Handles undefined', () =>
  expect(truncateAuthors(undefined)).toMatchInlineSnapshot('""'));