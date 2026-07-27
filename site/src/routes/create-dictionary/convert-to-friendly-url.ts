const SPACES = /\s+/g
const NOT_LOWERCASE_LETTERS_NUMBERS_HYPHEN = /[^a-z0-9-]/g
const URL_SCHEME = /^https?\s*:?\/{0,2}/i
const WWW_PREFIX = /^www\./i
const OWN_DOMAIN = /^livingdictionaries\.app\/?/i

/**
 * True when the raw input reads like a pasted URL rather than a name/slug —
 * used to clean it AND to emit the `dict_slug_suspicious` telemetry (a user
 * once created a dictionary whose slug was the truncated paste
 * `httpslivingdictionari`, so every entry under it 404'd).
 */
export function is_url_like(input: string): boolean {
  return /^\s*(?:https?[:/]|www\.|livingdictionaries\.app)/i.test(input)
}

/** Strip URL scaffolding (scheme, www., our own domain) so a pasted URL degrades to its meaningful part. */
function strip_url_junk(input: string): string {
  return input
    .trim()
    .replace(URL_SCHEME, '')
    .replace(WWW_PREFIX, '')
    .replace(OWN_DOMAIN, '')
}

export function convert_to_friendly_url(url: string, max_length = 25) {
  return strip_url_junk(url)
    .slice(0, max_length)
    .trim()
    .replace(SPACES, '-')
    .normalize('NFD') // separate diacritics from letters in unicode
    .toLowerCase()
    .replace(NOT_LOWERCASE_LETTERS_NUMBERS_HYPHEN, '')
}

if (import.meta.vitest) {
  describe(convert_to_friendly_url, () => {
    test('remove diacritics', () => {
      expect(convert_to_friendly_url('résumé')).toEqual('resume')
      expect(convert_to_friendly_url('mañana')).toEqual('manana')
    })

    test('trims, truncates, lowercases, turn space into hyphen, and removes diacritics', () => {
      expect(convert_to_friendly_url(' Hi! This is my 1st résumé and a bit long')).toMatchInlineSnapshot('"hi-this-is-my-1st-resume"')
    })

    test('strips a pasted URL down to its meaningful part (the httpslivingdictionari case)', () => {
      expect(convert_to_friendly_url('https://livingdictionaries.app/zapoteco-de-analco/entries')).toEqual('zapoteco-de-analcoentrie')
      expect(convert_to_friendly_url('https://livingdictionaries.app')).toEqual('')
      expect(convert_to_friendly_url('www.example.com my language')).toEqual('examplecom-my-language')
      expect(convert_to_friendly_url('http://My Language')).toEqual('my-language')
    })
  })

  describe(is_url_like, () => {
    test('flags pasted URLs', () => {
      expect(is_url_like('https://livingdictionaries.app/x')).toBe(true)
      expect(is_url_like('http://example.com')).toBe(true)
      expect(is_url_like('www.example.com')).toBe(true)
      expect(is_url_like('livingdictionaries.app/x')).toBe(true)
    })
    test('does not flag normal names', () => {
      expect(is_url_like('Zapoteco de Analco')).toBe(false)
      expect(is_url_like('Sugt’stun')).toBe(false)
    })
  })
}
