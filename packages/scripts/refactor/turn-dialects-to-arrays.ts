export function turn_dialect_strings_to_arrays(dialect: string): string[] {
  if (dialect.includes(', ')) {
    const dialects = dialect.split(', ');
    return dialects;
  }
  return [dialect];
}


if (import.meta.vitest) {
  describe('turn_dialect_strings_to_arrays', () => {
    test('turns simple dialect string into an array', () => {
      const dialect = 'east';
      expect(turn_dialect_strings_to_arrays(dialect)).toEqual(['east']);
    });
    test('turns multiple dialects as a string into an array with multiple elements', () => {
      const dialect = 'east, west, north, south';
      expect(turn_dialect_strings_to_arrays(dialect)).toEqual(['east', 'west', 'north', 'south']);
    });
  });
}
