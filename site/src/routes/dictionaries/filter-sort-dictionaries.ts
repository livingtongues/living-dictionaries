/**
 * Search + sort for the public dictionary directory (`/dictionaries`).
 *
 * WHY (product-journey review, 2026-08-02): the page is 221 rows of a plain table
 * whose only interactive controls were "Download (.csv)" and the URL in each row.
 * Column headers were inert, nothing could be filtered, and it is the one
 * "browse everything" route on the site — so anyone arriving here had to fall back
 * to the browser's own Ctrl+F. Everything needed is already in the browser; it
 * just offered no way to use it.
 *
 * Substring, NOT the home page's fuzzy scorer: this view stays a full ordered
 * table (sortable by any column), so a predictable "rows containing what I typed"
 * is the right contract. Diacritics fold both ways — a language whose name carries
 * marks must be findable from a plain-ASCII keyboard, and vice-versa.
 */

export type DictionarySortKey = 'name' | 'entry_count' | 'url' | 'iso_639_3' | 'glottocode' | 'location' | 'latitude' | 'longitude'

export interface DirectoryDictionary {
  url: string
  name: string
  entry_count: number
  iso_639_3?: string | null
  glottocode?: string | null
  location?: string | null
  alternate_names?: string[] | null
  coordinates?: { points?: { coordinates: { latitude: number, longitude: number } }[] | null } | null
  metadata?: { url?: string } | null
}

/** Lowercase + strip combining marks, so `Gtaʔ`/`gta` and `Kunwök`/`kunwok` both match. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function haystack(dictionary: DirectoryDictionary): string {
  return fold([
    dictionary.name,
    dictionary.url,
    ...(dictionary.alternate_names ?? []),
    dictionary.iso_639_3 ?? '',
    dictionary.glottocode ?? '',
    dictionary.location ?? '',
  ].join(' '))
}

export function filter_dictionaries<T extends DirectoryDictionary>({ dictionaries, query }: {
  dictionaries: T[]
  query: string
}): T[] {
  const needle = fold(query.trim())
  if (!needle)
    return dictionaries
  // Every whitespace-separated term must appear somewhere — "india gta" works.
  const terms = needle.split(/\s+/)
  return dictionaries.filter((dictionary) => {
    const text = haystack(dictionary)
    return terms.every(term => text.includes(term))
  })
}

function sort_value(dictionary: DirectoryDictionary, key: DictionarySortKey): string | number {
  switch (key) {
    case 'name': return fold(dictionary.name)
    case 'entry_count': return dictionary.entry_count ?? 0
    case 'url': return fold(dictionary.metadata?.url || dictionary.url)
    case 'iso_639_3': return fold(dictionary.iso_639_3 ?? '')
    case 'glottocode': return fold(dictionary.glottocode ?? '')
    case 'location': return fold(dictionary.location ?? '')
    case 'latitude': return dictionary.coordinates?.points?.[0]?.coordinates.latitude ?? Number.NEGATIVE_INFINITY
    case 'longitude': return dictionary.coordinates?.points?.[0]?.coordinates.longitude ?? Number.NEGATIVE_INFINITY
  }
}

/**
 * Blank/missing values always sink to the bottom, whichever direction is active —
 * sorting by ISO code to see "which languages have one" is useless if descending
 * just fills the screen with empty cells.
 */
export function sort_dictionaries<T extends DirectoryDictionary>({ dictionaries, key, ascending }: {
  dictionaries: T[]
  key: DictionarySortKey
  ascending: boolean
}): T[] {
  const direction = ascending ? 1 : -1
  return [...dictionaries].sort((a, b) => {
    const left = sort_value(a, key)
    const right = sort_value(b, key)
    const left_empty = left === '' || left === Number.NEGATIVE_INFINITY
    const right_empty = right === '' || right === Number.NEGATIVE_INFINITY
    if (left_empty !== right_empty)
      return left_empty ? 1 : -1
    if (left === right)
      return fold(a.name) < fold(b.name) ? -1 : 1
    return left > right ? direction : -direction
  })
}

if (import.meta.vitest) {
  const rows: DirectoryDictionary[] = [
    { url: 'gta', name: 'GtaɁ', entry_count: 6378, iso_639_3: 'gaq', glottocode: 'didey1236', location: 'Odisha, India', alternate_names: ['Didayi'] },
    { url: 'achi', name: 'Achi', entry_count: 1500, iso_639_3: 'acr', glottocode: null, location: 'Guatemala', alternate_names: [] },
    { url: 'kihunde', name: 'Kihunde', entry_count: 6648, iso_639_3: null, glottocode: 'hund1238', location: 'DRC', alternate_names: null },
  ]

  describe(filter_dictionaries, () => {
    it('returns everything for a blank query', () => {
      expect(filter_dictionaries({ dictionaries: rows, query: '  ' })).toHaveLength(3)
    })

    it('matches an ALTERNATE name — the one thing the old page could not do', () => {
      expect(filter_dictionaries({ dictionaries: rows, query: 'didayi' }).map(row => row.url)).toEqual(['gta'])
    })

    it('folds diacritics both directions', () => {
      expect(filter_dictionaries({ dictionaries: rows, query: 'gtaɂ' }).map(row => row.url)).toEqual(['gta'])
      expect(filter_dictionaries({ dictionaries: rows, query: 'gta' }).map(row => row.url)).toEqual(['gta'])
    })

    it('matches location and codes', () => {
      expect(filter_dictionaries({ dictionaries: rows, query: 'india' }).map(row => row.url)).toEqual(['gta'])
      expect(filter_dictionaries({ dictionaries: rows, query: 'acr' }).map(row => row.url)).toEqual(['achi'])
    })

    it('requires every term to match', () => {
      expect(filter_dictionaries({ dictionaries: rows, query: 'odisha india' }).map(row => row.url)).toEqual(['gta'])
      expect(filter_dictionaries({ dictionaries: rows, query: 'odisha guatemala' })).toEqual([])
    })
  })

  describe(sort_dictionaries, () => {
    it('sorts by name A→Z and Z→A', () => {
      expect(sort_dictionaries({ dictionaries: rows, key: 'name', ascending: true }).map(row => row.url)).toEqual(['achi', 'gta', 'kihunde'])
      expect(sort_dictionaries({ dictionaries: rows, key: 'name', ascending: false }).map(row => row.url)).toEqual(['kihunde', 'gta', 'achi'])
    })

    it('sorts numerically by entry count', () => {
      expect(sort_dictionaries({ dictionaries: rows, key: 'entry_count', ascending: false }).map(row => row.url)).toEqual(['kihunde', 'gta', 'achi'])
    })

    it('sinks blanks to the bottom in BOTH directions', () => {
      expect(sort_dictionaries({ dictionaries: rows, key: 'iso_639_3', ascending: true }).map(row => row.url)).toEqual(['achi', 'gta', 'kihunde'])
      expect(sort_dictionaries({ dictionaries: rows, key: 'iso_639_3', ascending: false }).map(row => row.url)).toEqual(['gta', 'achi', 'kihunde'])
    })

    it('does not mutate the input array', () => {
      const original = rows.map(row => row.url)
      sort_dictionaries({ dictionaries: rows, key: 'entry_count', ascending: true })
      expect(rows.map(row => row.url)).toEqual(original)
    })
  })
}
