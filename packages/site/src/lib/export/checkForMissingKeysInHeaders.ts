export function checkForMissingKeysInHeaders(headers: Record<string, any>, items: Record<string, any>[]) {
  const headersKeys = Object.keys(headers);
  const itemKeys = new Set(items.map((item) => Object.keys(item)).flat());
  const missingKeys = Array.from(itemKeys).filter((key) => !headersKeys.includes(key));
  if (missingKeys.length > 0) {
    console.warn(
      `Missing keys in headers: ${missingKeys.join(
        ', '
      )}. These keys will not be included in the CSV.`
    );
  }
}

if (import.meta.vitest) {
  describe('checkForMissingKeysInHeaders', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const items = [
      { name: 'Alice', age: 30, city: 'New York' },
      { name: 'Bob', age: 40, city: 'San Francisco' },
    ];

    test('warns for keys found in items not found in headers', () => {
      const headers = { name: 'Name', age: 'Age' };
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      checkForMissingKeysInHeaders(headers, items);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Missing keys in headers: city. These keys will not be included in the CSV.'
      );
    });

    test('does not warn when all item keys are found in headers', () => {
      const headers = { name: 'Name', age: 'Age', city: 'City' };
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      checkForMissingKeysInHeaders(headers, items);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
}
