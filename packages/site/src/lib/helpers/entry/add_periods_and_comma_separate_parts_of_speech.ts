export function add_periods_and_comma_separate_parts_of_speech(partOfSpeech: string | string[]): string {
  if (partOfSpeech) {
    if (typeof partOfSpeech !== 'string' && partOfSpeech.length > 0)
      return `${partOfSpeech.join('., ')}.`

    if (typeof partOfSpeech === 'string')
      return `${partOfSpeech}.`
  }
  return ''
}

if (import.meta.vitest) {
  describe('add_periods_and_comma_separate_parts_of_speech', () => {
    test('handles a string', () => {
      expect(add_periods_and_comma_separate_parts_of_speech('n')).toMatchInlineSnapshot('"n."')
    })
    test('handles empty string', () => {
      expect(add_periods_and_comma_separate_parts_of_speech('')).toMatchInlineSnapshot('""')
    })
    test('places a period after item in an array', () => {
      expect(add_periods_and_comma_separate_parts_of_speech(['v'])).toMatchInlineSnapshot('"v."')
    })
    test('places a period after each item in an array', () => {
      expect(add_periods_and_comma_separate_parts_of_speech(['n', 'adj', 'v'])).toMatchInlineSnapshot('"n., adj., v."')
    })
    test('handles empty array', () => {
      expect(add_periods_and_comma_separate_parts_of_speech([])).toMatchInlineSnapshot('""')
    })
    test('handles null', () => {
      expect(add_periods_and_comma_separate_parts_of_speech(null)).toMatchInlineSnapshot('""')
    })
  })
}
