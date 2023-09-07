const SPACES = /\s+/g;
const NOT_LOWERCASE_LETTERS_NUMBERS_HYPHEN = /[^a-z0-9-]/g;

export  function convertToFriendlyUrl(url: string, maxLength = 25) {
  return url
    .trim()
    .slice(0, maxLength)
    .trim()
    .replace(SPACES, '-')
    .normalize('NFD') // separate diacritics from letters in unicode
    .toLowerCase()
    .replace(NOT_LOWERCASE_LETTERS_NUMBERS_HYPHEN, '')
}

if (import.meta.vitest) {
  describe(convertToFriendlyUrl, () => {
    test('remove diacritics', () => {
      expect(convertToFriendlyUrl('résumé')).toEqual('resume');
      expect(convertToFriendlyUrl('mañana')).toEqual('manana');
    });

    test('trims, truncates, lowercases, turn space into hyphen, and removes diacritics', () => {
      expect(convertToFriendlyUrl(' Hi! This is my 1st résumé and a bit long')).toMatchInlineSnapshot('"hi-this-is-my-1st-resume"');
    });
  });
}
