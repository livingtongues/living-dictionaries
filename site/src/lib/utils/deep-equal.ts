/**
 * Structural equality for JSON-shaped values (the shape a query-param store holds:
 * plain objects, arrays, strings, numbers, booleans, null). Object key order is
 * ignored; array order is significant. Used to dedupe redundant store emissions so
 * a URL echo that parses to a value we already hold doesn't push a fresh object
 * identity into subscribers (which was feeding the entry-page reactive loop).
 */
export function deep_equal(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (typeof a !== typeof b)
    return false
  if (a === null || b === null || typeof a !== 'object')
    return false // primitives already handled by `===`; a null vs object mismatch is unequal

  const a_is_array = Array.isArray(a)
  const b_is_array = Array.isArray(b)
  if (a_is_array !== b_is_array)
    return false

  if (a_is_array && b_is_array) {
    if (a.length !== b.length)
      return false
    for (let i = 0; i < a.length; i++) {
      if (!deep_equal(a[i], b[i]))
        return false
    }
    return true
  }

  const a_obj = a as Record<string, unknown>
  const b_obj = b as Record<string, unknown>
  const a_keys = Object.keys(a_obj)
  const b_keys = Object.keys(b_obj)
  if (a_keys.length !== b_keys.length)
    return false
  for (const key of a_keys) {
    if (!Object.prototype.hasOwnProperty.call(b_obj, key))
      return false
    if (!deep_equal(a_obj[key], b_obj[key]))
      return false
  }
  return true
}

if (import.meta.vitest) {
  describe(deep_equal, () => {
    test('primitives', () => {
      expect(deep_equal(1, 1)).toBe(true)
      expect(deep_equal('a', 'a')).toBe(true)
      expect(deep_equal(true, true)).toBe(true)
      expect(deep_equal(1, 2)).toBe(false)
      expect(deep_equal('a', 'b')).toBe(false)
      expect(deep_equal(1, '1')).toBe(false)
      expect(deep_equal(0, false)).toBe(false)
    })
    test('null and undefined', () => {
      expect(deep_equal(null, null)).toBe(true)
      expect(deep_equal(undefined, undefined)).toBe(true)
      expect(deep_equal(null, undefined)).toBe(false)
      expect(deep_equal(null, {})).toBe(false)
      expect(deep_equal({}, null)).toBe(false)
    })
    test('flat objects, key order ignored', () => {
      expect(deep_equal({ page: 1, query: 'a' }, { query: 'a', page: 1 })).toBe(true)
      expect(deep_equal({ page: 1, query: 'a' }, { page: 1, query: 'b' })).toBe(false)
      expect(deep_equal({ page: 1 }, { page: 1, query: 'a' })).toBe(false)
      expect(deep_equal({ page: 1, query: 'a' }, { page: 1 })).toBe(false)
    })
    test('nested objects and arrays (query-param shapes)', () => {
      expect(deep_equal(
        { query: 'anno', tags: ['teglunaliq'], page: 1 },
        { page: 1, query: 'anno', tags: ['teglunaliq'] },
      )).toBe(true)
      expect(deep_equal(
        { query: 'anno', tags: ['a', 'b'] },
        { query: 'anno', tags: ['b', 'a'] },
      )).toBe(false) // array order is significant
      expect(deep_equal(
        { query: 'anno', tags: ['a'] },
        { query: 'anno', tags: ['a', 'b'] },
      )).toBe(false)
    })
    test('arrays', () => {
      expect(deep_equal([], [])).toBe(true)
      expect(deep_equal([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(deep_equal([1, 2], [1, 2, 3])).toBe(false)
      expect(deep_equal([1, 2, 3], [3, 2, 1])).toBe(false)
      expect(deep_equal([{ a: 1 }], [{ a: 1 }])).toBe(true)
      expect(deep_equal({ 0: 'a', 1: 'b' }, ['a', 'b'])).toBe(false) // object vs array
    })
    test('empty objects', () => {
      expect(deep_equal({}, {})).toBe(true)
      expect(deep_equal({}, { a: undefined })).toBe(false)
    })
  })
}
