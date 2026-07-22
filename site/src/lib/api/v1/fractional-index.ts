/**
 * Fractional indexing for ordering text-sentences (`sentences.sort_key`).
 *
 * `key_between(a, b)` returns a string that sorts lexicographically strictly
 * between `a` and `b` (a `null` bound = ±infinity). Inserting between two
 * existing keys never has to rewrite neighbours — you just mint a new key in the
 * gap. Keys are lowercase base-36 fractions (an implicit leading `0.`), so plain
 * string comparison in SQLite's `ORDER BY sort_key` yields the intended order.
 *
 * Adapted from David Greenspan's fractional-indexing midpoint algorithm.
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
const [ZERO] = DIGITS

/**
 * A string strictly between `lower` and `upper` (both base-36 fractions, or
 * `null` for an open bound). Requires `lower < upper` when both are given.
 * The empty string acts as the -infinity sentinel. Outputs never carry a
 * trailing zero, which is the invariant that keeps `midpoint` terminating.
 */
export function key_between(lower: string | null, upper: string | null): string {
  if (lower !== null && upper !== null && lower >= upper)
    throw new Error(`fractional-index: lower (${lower}) must sort before upper (${upper})`)
  return midpoint(lower ?? '', upper)
}

/** Ascending keys for `count` initial items, evenly spread. */
export function initial_keys(count: number): string[] {
  const keys: string[] = []
  let prev: string | null = null
  for (let i = 0; i < count; i++) {
    const key = key_between(prev, null)
    keys.push(key)
    prev = key
  }
  return keys
}

/**
 * A base-36 fraction strictly between `a` and `b` (`a` may be the `''`
 * -infinity sentinel; `b === null` is +infinity). Canonical fractional-indexing
 * midpoint (David Greenspan). Relies on inputs having NO trailing zero.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b)
    throw new Error(`fractional-index: ${a} >= ${b}`)

  if (b !== null) {
    // Copy the shared prefix (padding `a` with zeros past its end), recurse on
    // the remainder once the first differing digit is found.
    let n = 0
    while ((a[n] ?? ZERO) === b[n])
      n++
    if (n > 0)
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }

  const digit_a = a ? DIGITS.indexOf(a[0]) : 0
  const digit_b = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length
  if (digit_b - digit_a > 1)
    return DIGITS[Math.round(0.5 * (digit_a + digit_b))]

  // First digits are consecutive: keep `b`'s narrowing digit, or dig into `a`.
  if (b !== null && b.length > 1)
    return b.slice(0, 1)
  return DIGITS[digit_a] + midpoint(a.slice(1), null)
}

if (import.meta.vitest) {
  function sorted(keys: string[]): boolean {
    for (let i = 1; i < keys.length; i++) {
      if (keys[i - 1] >= keys[i])
        return false
    }
    return true
  }

  describe(key_between, () => {
    it('appends after when upper is null', () => {
      const a = key_between(null, null)
      const b = key_between(a, null)
      const c = key_between(b, null)
      expect(sorted([a, b, c])).toBe(true)
    })

    it('inserts strictly between two keys', () => {
      const a = key_between(null, null)
      const b = key_between(a, null)
      const mid = key_between(a, b)
      expect(a < mid && mid < b).toBe(true)
    })

    it('prepends before when lower is null', () => {
      const a = key_between(null, null)
      const before = key_between(null, a)
      expect(before < a).toBe(true)
    })

    it('throws when order is inverted', () => {
      expect(() => key_between('z', 'a')).toThrow()
    })

    it('survives many midpoint inserts between the first two keys', () => {
      const [lo, initial_hi] = initial_keys(2)
      let hi = initial_hi
      for (let i = 0; i < 50; i++) {
        const mid = key_between(lo, hi)
        expect(lo < mid && mid < hi).toBe(true)
        hi = mid
      }
    })

    it('random insertions stay globally ordered', () => {
      const list = initial_keys(3)
      for (let i = 0; i < 200; i++) {
        const pos = Math.floor(Math.random() * (list.length + 1))
        const lower = pos === 0 ? null : list[pos - 1]
        const upper = pos === list.length ? null : list[pos]
        list.splice(pos, 0, key_between(lower, upper))
      }
      expect(sorted(list)).toBe(true)
    })
  })

  describe(initial_keys, () => {
    it('produces ascending unique keys', () => {
      const keys = initial_keys(10)
      expect(keys).toHaveLength(10)
      expect(new Set(keys).size).toBe(10)
      expect(sorted(keys)).toBe(true)
    })

    it('returns empty for count 0', () => {
      expect(initial_keys(0)).toEqual([])
    })
  })
}
