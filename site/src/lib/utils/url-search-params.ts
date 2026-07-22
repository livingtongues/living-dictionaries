export type QueryParamValue = string | number | null | undefined

interface ReadChoiceParamOptions<T extends string> {
  search_params: URLSearchParams
  key: string
  choices: readonly T[]
  fallback: T
}

export function read_choice_param<T extends string>({ search_params, key, choices, fallback }: ReadChoiceParamOptions<T>): T {
  const value = search_params.get(key)
  return value && choices.includes(value as T) ? value as T : fallback
}

interface ReadPositiveIntParamOptions {
  search_params: URLSearchParams
  key: string
  fallback?: number
}

export function read_positive_int_param({ search_params, key, fallback = 1 }: ReadPositiveIntParamOptions): number {
  const value = Number(search_params.get(key))
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

interface UpdateQueryParamsOptions {
  url: URL
  values: Record<string, QueryParamValue>
  defaults?: Record<string, QueryParamValue>
}

export function update_query_params({ url, values, defaults = {} }: UpdateQueryParamsOptions): URL {
  const next_url = new URL(url)
  for (const [key, value] of Object.entries(values)) {
    const string_value = value === null || value === undefined ? '' : String(value).trim()
    const default_value = defaults[key]
    if (!string_value || (default_value !== null && default_value !== undefined && string_value === String(default_value)))
      next_url.searchParams.delete(key)
    else
      next_url.searchParams.set(key, string_value)
  }
  return next_url
}

if (import.meta.vitest) {
  describe(read_choice_param, () => {
    it('accepts known values and rejects malformed values', () => {
      const valid = new URLSearchParams('filter=active')
      const invalid = new URLSearchParams('filter=surprise')
      expect(read_choice_param({ search_params: valid, key: 'filter', choices: ['all', 'active'], fallback: 'all' })).toBe('active')
      expect(read_choice_param({ search_params: invalid, key: 'filter', choices: ['all', 'active'], fallback: 'all' })).toBe('all')
    })
  })

  describe(read_positive_int_param, () => {
    it('accepts positive integers and rejects other values', () => {
      expect(read_positive_int_param({ search_params: new URLSearchParams('page=3'), key: 'page' })).toBe(3)
      expect(read_positive_int_param({ search_params: new URLSearchParams('page=-2'), key: 'page' })).toBe(1)
      expect(read_positive_int_param({ search_params: new URLSearchParams('page=1.5'), key: 'page' })).toBe(1)
    })
  })

  describe(update_query_params, () => {
    it('preserves unrelated parameters and omits defaults', () => {
      const url = new URL('https://example.com/admin/users?source=shared&page=4#focus')
      const result = update_query_params({
        url,
        values: { filter: 'all', q: 'Luke', page: null },
        defaults: { filter: 'all', q: '' },
      })
      expect(result.toString()).toBe('https://example.com/admin/users?source=shared&q=Luke#focus')
    })
  })
}
