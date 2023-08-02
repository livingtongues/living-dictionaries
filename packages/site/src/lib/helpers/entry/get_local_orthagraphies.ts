import type { ExpandedEntry } from '@living-dictionaries/types';

export function get_local_orthographies(entry: Partial<ExpandedEntry>): string[] {
  const possible_local_orthography_fields = ['local_orthography_1', 'local_orthography_2', 'local_orthography_3', 'local_orthography_4', 'local_orthography_5'];
  const local_orthographies_fields_used = Object.keys(entry).filter((field) => {
    if (possible_local_orthography_fields.includes(field)) return !!entry[field];
  });
  return local_orthographies_fields_used.map((field) => entry[field]);
}

if (import.meta.vitest) {
  describe('get_local_orthographies', () => {
    test('returns array of local orthographies', () => {
      const entryWith5LocalOrthographies: Partial<ExpandedEntry> = {
        local_orthography_1:'Nnọọ',
        local_orthography_2: 'Привет',
        local_orthography_3: 'سلام',
        local_orthography_4: 'नमस्ते',
        local_orthography_5: 'שלום',
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
      const entryWith3LocalOrthographies: Partial<ExpandedEntry> = {
        local_orthography_1: 'さよなら',
        local_orthography_2: '안녕',
        local_orthography_3: '',
        local_orthography_4: null,
      };
      expect(get_local_orthographies(entryWith3LocalOrthographies)).toEqual(['さよなら', '안녕']);
    });
  });
}
