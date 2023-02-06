import type { IEntry } from '@living-dictionaries/types';

export function get_local_orthographies(entry: Partial<IEntry>): string[] {
  const possible_local_orthography_fields = ['lo', 'lo2', 'lo3', 'lo4', 'lo5'];
  const local_orthographies_fields_used = Object.keys(entry).filter((field) => {
    if (possible_local_orthography_fields.includes(field)) return !!entry[field];
  });
  return local_orthographies_fields_used.map((field) => entry[field]);
}

if (import.meta.vitest) {
  describe('get_local_orthographies', () => {
    test('returns array of local orthographies', () => {
      const entryWith5LocalOrthographies: Partial<IEntry> = {
        lo: 'Nnọọ',
        lo2: 'Привет',
        lo3: 'سلام',
        lo4: 'नमस्ते',
        lo5: 'שלום',
      };
      expect(get_local_orthographies(entryWith5LocalOrthographies)).toEqual([
        'Nnọọ',
        'Привет',
        'سلام',
        'नमस्ते',
        'שלום',
      ]);
    });
    test('does not return field if field is empty or missing', () => {
      const entryWith3LocalOrthographies: Partial<IEntry> = {
        lo: 'さよなら',
        lo2: '안녕',
        lo3: '',
        lo4: null,
      };
      expect(get_local_orthographies(entryWith3LocalOrthographies)).toEqual(['さよなら', '안녕']);
    });
  });
}
