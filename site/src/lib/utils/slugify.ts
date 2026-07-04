/**
 * Turn arbitrary text into a URL/id-safe slug: lowercase ASCII, diacritics
 * stripped, non-alphanumerics collapsed to single hyphens, trimmed. Used for
 * source slugs (and safe to reuse elsewhere).
 */
export function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * A slug guaranteed unique against `taken` — appends `-2`, `-3`, … on collision.
 * Falls back to `fallback` when the input slugifies to empty.
 */
export function unique_slug({ input, taken, fallback = 'source' }: { input: string, taken: Set<string>, fallback?: string }): string {
  const base = slugify(input) || fallback
  if (!taken.has(base))
    return base
  let n = 2
  while (taken.has(`${base}-${n}`))
    n++
  return `${base}-${n}`
}

if (import.meta.vitest) {
  describe(slugify, () => {
    it('lowercases, strips diacritics, hyphenates', () => {
      expect(slugify('Smith, Jane E. 2020')).toBe('smith-jane-e-2020')
    })
    it('strips leading/trailing separators', () => {
      expect(slugify('  —Hello—  ')).toBe('hello')
    })
    it('returns empty for punctuation-only', () => {
      expect(slugify('!!!')).toBe('')
    })
  })

  describe(unique_slug, () => {
    it('returns the base slug when free', () => {
      expect(unique_slug({ input: 'Lee 1998', taken: new Set() })).toBe('lee-1998')
    })
    it('suffixes on collision', () => {
      expect(unique_slug({ input: 'Lee 1998', taken: new Set(['lee-1998', 'lee-1998-2']) })).toBe('lee-1998-3')
    })
    it('falls back when empty', () => {
      expect(unique_slug({ input: '!!!', taken: new Set(['source']) })).toBe('source-2')
    })
  })
}
