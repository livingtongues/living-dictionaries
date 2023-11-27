export function stringifyArray(array: (string | number)[]): string {
  if (!array?.length) return null;
  return `{${array.filter(v => !!v).join(', ')}}`;
}

if (import.meta.vitest) {
  describe(stringifyArray, () => {
    test('handles strings', () => {
      expect(stringifyArray(['a', 'b'])).toEqual('{a, b}');
    });
    test('handles numbers', () => {
      expect(stringifyArray([1, '2'])).toEqual('{1, 2}');
    });
    test('return null for empty array', () => {
      expect(stringifyArray([])).toEqual(null);
    });
    test('handles undfined inside array', () => {
      expect(stringifyArray([undefined, '2'])).toEqual('{2}');
    });
    test('handles undfined inside array', () => {
      expect(stringifyArray(undefined)).toEqual(null);
    });
  });
}
