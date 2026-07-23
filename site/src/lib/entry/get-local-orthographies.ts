import type { MultiString } from '$lib/types'

export function get_local_orthographies(lexeme: MultiString, { exclude_code }: { exclude_code?: string } = {}): string[] {
  if (!lexeme) return []
  return Object.entries(lexeme)
    .filter(([key]) => key !== 'default' && key !== exclude_code)
    .map(([, value]) => value)
    .filter(Boolean)
}

if (import.meta.vitest) {
  describe(get_local_orthographies, () => {
    test('returns array of local orthographies', () => {
      const lexeme: MultiString = {
        lo1: 'Nnọọ',
        lo2: 'Привет',
        lo3: 'سلام',
        lo4: 'नमस्ते',
        lo5: 'שלום',
      }
      expect(get_local_orthographies(lexeme)).toEqual([
        'Nnọọ',
        'Привет',
        'سلام',
        'नमस्ते',
        'שלום',
      ])
    })

    test('does not return null or empty string fields', () => {
      const lexeme: MultiString = {
        lo1: 'さよなら',
        lo2: '안녕',
        lo3: '',
        lo4: null,
      }
      expect(get_local_orthographies(lexeme)).toEqual(['さよなら', '안녕'])
    })

    test('excludes a promoted-headword code', () => {
      const lexeme: MultiString = {
        lo1: 'foo',
        lo2: 'bar',
      }
      expect(get_local_orthographies(lexeme, { exclude_code: 'lo1' })).toEqual(['bar'])
    })
  })
}
