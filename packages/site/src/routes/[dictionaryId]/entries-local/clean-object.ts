export function cleanObject(obj, cleanFalseValues = false) {
  const isArray = Array.isArray(obj);
  const isObject = typeof obj === 'object' && obj !== null;

  if (isArray) {
    const result = obj
      .filter(item => item !== null && item !== undefined && item !== '' && !(Array.isArray(item) && item.length === 0) && !(cleanFalseValues && item === false))
      .map(item => (typeof item === 'object' ? cleanObject(item, cleanFalseValues) : item));
    return result.length === 0 ? undefined : result;
  }

  if (isObject) {
    const result = Object.entries(obj)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0) && !(cleanFalseValues && value === false))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: typeof value === 'object' ? cleanObject(value, cleanFalseValues) : value }), {});
    return Object.keys(result).length === 0 ? undefined : result;
  }

  return obj;
}


if (import.meta.vitest) {
  describe(cleanObject, () => {
    test('should remove null, undefined, empty string, and empty array values from an object', () => {
      const obj = {
        a: 'a',
        b: null,
        c: undefined,
        d: '',
        e: [],
        f: {
          g: 'g',
          h: null,
          i: undefined,
          j: '',
          k: [],
        },
      };
      const expected = {
        a: 'a',
        f: {
          g: 'g',
        },
      };
      expect(cleanObject(obj)).toEqual(expected);
    });

    test('should not remove false values from an object when flag not set', () => {
      const obj = {
        b: false,
      };
      expect(cleanObject(obj)).toEqual(obj);
    });

    test('should remove false values from an object when flag set', () => {
      const obj = { b: false };
      expect(cleanObject(obj, true)).toBeUndefined();
    });

    test('should remove null, undefined, empty string, and empty array values from an array', () => {
      const arr = ['a', null, undefined, '', [], { g: 'g', h: null, i: undefined, j: '', k: [] }];
      const expected = ['a', { g: 'g' }];
      expect(cleanObject(arr)).toEqual(expected);
    });

    test('should return undefined for null, undefined, empty string, and empty array inputs', () => {
      expect(cleanObject(undefined)).toBeUndefined();
      expect(cleanObject([])).toBeUndefined();
      expect(cleanObject({a: null})).toBeUndefined();
      expect(cleanObject({})).toBeUndefined();
    });
  });
}
