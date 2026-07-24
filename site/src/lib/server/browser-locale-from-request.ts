/**
 * The visitor's PRIMARY preferred language from the `Accept-Language` header —
 * the raw material for "which i18n locales should we add" (tracked whether we
 * support the locale or not). Stamped per `/api/log` request like geo, so every
 * telemetry row carries it with zero client bytes.
 *
 * Stores the first (highest-priority) tag mostly as sent (e.g. `pt-BR`,
 * `zh-Hant`) with casing normalized to BCP-47 convention — analytics folds
 * variants when aggregating. Returns null for missing/wildcard/garbage headers.
 */
const LOCALE_TAG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i

export function browser_locale_from_request(request: Request): string | null {
  return parse_primary_locale(request.headers.get('accept-language'))
}

export function parse_primary_locale(header: string | null): string | null {
  if (!header)
    return null
  const first = header.split(',')[0]?.split(';')[0]?.trim() ?? ''
  if (!first || first === '*' || first.length > 35 || !LOCALE_TAG_RE.test(first))
    return null
  const [language, ...rest] = first.split('-')
  const normalized_rest = rest.map(part =>
    part.length === 2
      ? part.toUpperCase() // region: BR
      : part.length === 4
        ? part[0].toUpperCase() + part.slice(1).toLowerCase() // script: Hant
        : part.toLowerCase())
  return [language.toLowerCase(), ...normalized_rest].join('-')
}

if (import.meta.vitest) {
  describe(parse_primary_locale, () => {
    test('takes the first tag, dropping q-weights and the rest of the list', () => {
      expect(parse_primary_locale('pl-PL,pl;q=0.9,en-US;q=0.8')).toBe('pl-PL')
      expect(parse_primary_locale('fr')).toBe('fr')
    })
    test('normalizes casing to BCP-47 convention', () => {
      expect(parse_primary_locale('PT-br')).toBe('pt-BR')
      expect(parse_primary_locale('zh-hant-TW')).toBe('zh-Hant-TW')
    })
    test('rejects missing, wildcard, and malformed headers', () => {
      expect(parse_primary_locale(null)).toBe(null)
      expect(parse_primary_locale('*')).toBe(null)
      expect(parse_primary_locale('not a locale!!')).toBe(null)
      expect(parse_primary_locale('')).toBe(null)
    })
  })
}
