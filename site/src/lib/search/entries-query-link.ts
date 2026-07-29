import type { QueryParams } from './types'

/**
 * A link that opens the entries view already filtered to a specific set of rows.
 *
 * WHY (2026-07-29): import questions were being answered 3 times out of 15. The
 * most engaged curator read his conversation page, answered none of his six
 * questions, then opened the entries list and hand-built
 * `?q={"no_audio":true,"no_part_of_speech":true}` — the filter two of those
 * questions were about. Judgement is given where the person already is, so a
 * question has to be askable ON its rows.
 *
 * The entries view already accepts this whole vocabulary in its URL
 * (`QueryParamState`, key `q`), so nothing new is needed there. What is needed
 * is a validator: the query arrives from an import agent over the v1 API, and a
 * silently-ignored typo (`no_parts_of_speech`) produces a button that shows the
 * curator the WRONG set, which is worse than no button.
 */

/** Facets whose value is a list of ids/labels. Mirrors `QueryParams`. */
const ARRAY_KEYS = [
  'orthographies',
  'sources',
  'tags',
  'dialects',
  'parts_of_speech',
  'semantic_domains',
  'speakers',
  'review_categories',
] as const

/** Facets that are simply on or off. Mirrors `QueryParams`. */
const BOOLEAN_KEYS = [
  'has_review',
  'no_review',
  'has_audio',
  'no_audio',
  'has_sentence',
  'no_sentence',
  'has_image',
  'no_image',
  'has_video',
  'no_video',
  'has_speaker',
  'no_speaker',
  'has_noun_class',
  'no_noun_class',
  'has_plural_form',
  'no_plural_form',
  'has_part_of_speech',
  'no_part_of_speech',
  'has_semantic_domain',
  'no_semantic_domain',
] as const

const STRING_KEYS = ['query'] as const

export const ENTRIES_QUERY_KEYS = [...ARRAY_KEYS, ...BOOLEAN_KEYS, ...STRING_KEYS] as const

/** Every facet optional — `QueryParams` itself requires `page` + `query`, a link never does. */
export type EntriesQuery = Partial<Pick<QueryParams, typeof ENTRIES_QUERY_KEYS[number]>> & { page?: number }

export type ParsedEntriesQuery
  = | { entries_query: EntriesQuery, error?: undefined }
    | { entries_query?: undefined, error: string }

/**
 * Validate an agent-supplied filter object, dropping empty facets. Returns an
 * `error` string (never throws) so the caller can answer 400 with the offending
 * key named — an agent that gets "unknown filter `no_parts_of_speech`" fixes it;
 * one whose typo was ignored never learns.
 */
export function parse_entries_query(value: unknown): ParsedEntriesQuery {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { error: 'entries_query must be an object of entries-view filters' }

  const entries_query: EntriesQuery = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined)
      continue
    if (key === 'page')
      continue // always rewritten to 1 — a deep link into page 7 of a filter is never what was meant
    if ((ARRAY_KEYS as readonly string[]).includes(key)) {
      if (!Array.isArray(raw) || raw.some(item => typeof item !== 'string' || !item.trim()))
        return { error: `entries_query.${key} must be an array of non-empty strings` }
      if (raw.length)
        (entries_query as Record<string, unknown>)[key] = raw.map((item: string) => item.trim())
      continue
    }
    if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
      if (typeof raw !== 'boolean')
        return { error: `entries_query.${key} must be true or false` }
      if (raw)
        (entries_query as Record<string, unknown>)[key] = true
      continue
    }
    if ((STRING_KEYS as readonly string[]).includes(key)) {
      if (typeof raw !== 'string')
        return { error: `entries_query.${key} must be a string` }
      if (raw.trim())
        (entries_query as Record<string, unknown>)[key] = raw.trim()
      continue
    }
    return { error: `entries_query.${key} is not an entries-view filter (allowed: ${ENTRIES_QUERY_KEYS.join(', ')})` }
  }

  if (!Object.keys(entries_query).length)
    return { error: 'entries_query has no filters — leave it off rather than linking to every entry' }

  return { entries_query }
}

/**
 * The href that opens that filtered set. `page: 1` is included deliberately: the
 * URL value REPLACES the whole params object rather than merging into the
 * defaults, so a link without it lands on an undefined page.
 */
export function entries_query_href({ dictionary_url, entries_query }: {
  dictionary_url: string
  entries_query: EntriesQuery | string
}): string | null {
  let parsed: unknown = entries_query
  if (typeof entries_query === 'string') {
    try {
      parsed = JSON.parse(entries_query)
    } catch {
      return null
    }
  }
  const { entries_query: valid } = parse_entries_query(parsed)
  if (!valid)
    return null
  return `/${dictionary_url}/entries?q=${encodeURIComponent(JSON.stringify({ page: 1, ...valid }))}`
}

if (import.meta.vitest) {
  describe(parse_entries_query, () => {
    test('the real 2026-07-28 case: source + a missing-field facet', () => {
      expect(parse_entries_query({ sources: ['mg-bitd-wordlist'], no_part_of_speech: true }))
        .toEqual({ entries_query: { sources: ['mg-bitd-wordlist'], no_part_of_speech: true } })
    })

    test('a typo names itself instead of silently showing the wrong entries', () => {
      const { error } = parse_entries_query({ no_parts_of_speech: true })
      expect(error).toContain('no_parts_of_speech')
    })

    test('wrong value shapes are refused', () => {
      expect(parse_entries_query({ sources: 'mg-bitd-wordlist' }).error).toContain('sources')
      expect(parse_entries_query({ no_audio: 'true' }).error).toContain('no_audio')
      expect(parse_entries_query({ query: 42 }).error).toContain('query')
      expect(parse_entries_query(['no_audio']).error).toBeTruthy()
      expect(parse_entries_query('no_audio').error).toBeTruthy()
    })

    test('false and empty facets are dropped; an all-empty query is refused outright', () => {
      expect(parse_entries_query({ no_audio: false, sources: ['a'] })).toEqual({ entries_query: { sources: ['a'] } })
      expect(parse_entries_query({ no_audio: false, tags: [] }).error).toContain('no filters')
    })

    test('page is never honoured — a deep link into page 7 of a filter is not what was meant', () => {
      expect(parse_entries_query({ page: 7, no_audio: true })).toEqual({ entries_query: { no_audio: true } })
    })
  })

  describe(entries_query_href, () => {
    test('builds the URL the entries view already reads', () => {
      expect(entries_query_href({ dictionary_url: 'iipay-aa', entries_query: { no_audio: true } }))
        .toBe(`/iipay-aa/entries?q=${encodeURIComponent('{"page":1,"no_audio":true}')}`)
    })

    test('accepts the stored JSON string straight out of the DB column', () => {
      expect(entries_query_href({ dictionary_url: 'iipay-aa', entries_query: '{"sources":["mg-bitd-wordlist"]}' }))
        .toBe(`/iipay-aa/entries?q=${encodeURIComponent('{"page":1,"sources":["mg-bitd-wordlist"]}')}`)
    })

    test('an unusable stored value renders no button rather than a broken one', () => {
      expect(entries_query_href({ dictionary_url: 'iipay-aa', entries_query: 'not json' })).toBe(null)
      expect(entries_query_href({ dictionary_url: 'iipay-aa', entries_query: '{}' })).toBe(null)
      expect(entries_query_href({ dictionary_url: 'iipay-aa', entries_query: '{"bogus":true}' })).toBe(null)
    })
  })
}
