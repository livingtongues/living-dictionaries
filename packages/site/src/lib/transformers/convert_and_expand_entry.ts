import type { ActualDatabaseEntry, ExpandedEntry, GoalDatabaseEntry } from '@living-dictionaries/types';
import { convert_entry_to_current_shape } from './convert_entry_to_current_shape';
import { expand_entry } from './expand_entry';
import type { TranslateFunction } from '$lib/i18n/types';

/**
 * using ..entry can be removed if:
 * 1) entire front-end uses expanded format - DONE
 * 2) all fields are expanded or at least copied into expanded entry (including deprecated fields in sounds files like previousFileName) until completely refactored out of database
 * should still retain abbreviated translated fields (ps, sdn) as they lose their database value when expanded (because of translation into current language)
 */
export function convert_and_expand_entry(entry: ActualDatabaseEntry, t: TranslateFunction): GoalDatabaseEntry & ExpandedEntry {
  const goal_database_entry = convert_entry_to_current_shape(entry);
  const expanded_entry = expand_entry(goal_database_entry, t);
  // @ts-ignore - TODO: can we remove ...entry?
  return {
    ...entry,
    ...goal_database_entry,
    ...expanded_entry
  };
}

if (import.meta.vitest) {
  describe(convert_and_expand_entry, () => {
    test('updates entry to goal database shape and expands for UI while keeping old database shape (actual database) until UI is refactored to use expanded shape', () => {
      const entry: ActualDatabaseEntry = {
        lo: 'lo1', // old shape
        lo2: 'lo2' // current shape
      }
      // @ts-ignore - TODO: can we remove ...entry?
      const expected: GoalDatabaseEntry & ExpandedEntry = {
        ...entry,
        lo1: 'lo1', // current shape for lo
        local_orthography_1: 'lo1',
        local_orthography_2: 'lo2',
        senses: [{}],
      };
      expect(convert_and_expand_entry(entry, () => '')).toEqual(expected);
    });
  });
}
