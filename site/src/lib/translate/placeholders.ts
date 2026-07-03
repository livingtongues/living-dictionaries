/**
 * `{token}` interpolation placeholders (see `$lib/i18n/interpolate.ts`) must
 * survive translation — these helpers drive the highlight + missing-token
 * warning in the /translate editor (warn-only; the save still goes through).
 */

export function extract_placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{\w+\}/g)].map(match => match[0]))]
}

/** Tokens present in the English source but absent from a non-empty translation. */
export function missing_placeholders({ en_value, value }: { en_value: string, value: string }): string[] {
  if (!value.trim())
    return []
  return extract_placeholders(en_value).filter(token => !value.includes(token))
}

/** Split a value into text/token parts so the UI can highlight tokens. */
export function split_on_placeholders(value: string): { text: string, is_token: boolean }[] {
  return value.split(/(\{\w+\})/g).filter(Boolean).map(text => ({ text, is_token: /^\{\w+\}$/.test(text) }))
}

if (import.meta.vitest) {
  describe(missing_placeholders, () => {
    test('flags tokens dropped from the translation', () => {
      expect(missing_placeholders({ en_value: 'Hi {name}, see {url}', value: 'Hola {name}' })).toEqual(['{url}'])
      expect(missing_placeholders({ en_value: 'Hi {name}', value: 'Hola {name}' })).toEqual([])
      expect(missing_placeholders({ en_value: 'Hi {name}', value: '  ' })).toEqual([]) // empty = delete, no warning
    })
  })

  describe(split_on_placeholders, () => {
    test('separates tokens from text', () => {
      expect(split_on_placeholders('Hi {name}!')).toEqual([
        { text: 'Hi ', is_token: false },
        { text: '{name}', is_token: true },
        { text: '!', is_token: false },
      ])
    })
  })
}
