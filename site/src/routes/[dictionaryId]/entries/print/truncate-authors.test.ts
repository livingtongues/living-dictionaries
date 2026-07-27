import { truncate_authors } from './truncate-authors'

// pulling examples from https://livingtongues.org/anderson-bibliography/
// most styles guides only invert the last name to the front for the first author for alphabetical reasons, after that we can rely on commas, 'and', and '&' to split authors.

describe(truncate_authors, () => {
  test('adds a comma after 1 author', () =>
    expect(truncate_authors('Anderson, Gregory D. S.')).toEqual('Anderson, Gregory D. S., '))

  test('dedupes end comma in 1 author citation', () =>
    expect(truncate_authors('Anderson, Gregory D. S.,')).toEqual('Anderson, Gregory D. S., '))

  test('leaves alone 2 authors below maxLengthLookingGoodInLetter', () =>
    expect(truncate_authors('Anderson, Gregory D. S. and Opino Gomango.')).toEqual('Anderson, Gregory D. S. and Opino Gomango., '))

  test('shortens 3 authors using an and exceeding maxLengthLookingGoodInLetter', () =>
    expect(
      truncate_authors('Derwing, Travis, Jamison Adler and James the Great Rossiter'),
    ).toEqual('Derwing, et al., '))

  test('shortens 3 authors using an ampersand exceeding maxLengthLookingGoodInLetter', () =>
    expect(
      truncate_authors('Córdova, D., T. Derwing , A. O. Summo, M G. Davids, & E. R. Timmo'),
    ).toEqual('Córdova, et al., '))

  test('does not add an extra comma when maxLengthLookingGoodInLetter lands at an intersection of a comma plus ampersand', () =>
    expect(
      truncate_authors('Córdova, D., A. O. Summo, M G. Davids, & Edward. R. Timmo'),
    ).toEqual('Córdova, et al., '))

  test('shows the full name if no comma is used', () =>
    expect(truncate_authors('James Rock, Bob Smith, Joe Blow, and Jim Doe')).toEqual('James Rock, et al., '))

  test('handles undefined', () => expect(truncate_authors(undefined)).toEqual(''))
})
