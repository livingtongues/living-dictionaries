import type { MultiString } from '@living-dictionaries/types'

export function get_local_orthographies(lexeme: MultiString): string[] {
  return Object.entries(lexeme)
    .filter(([key]) => key !== 'default')
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
  })
}
