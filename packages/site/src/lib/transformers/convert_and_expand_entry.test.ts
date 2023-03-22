import type { ActualDatabaseEntry, IEntry } from "@living-dictionaries/types";
import { convert_entry_to_current_shape } from "./convert_entry_to_current_shape";
import { expand_entry } from "./expand_entry";

describe('convert_and_expand_entry', () => {
  test('updates entry to goal database shape and expands for UI while keeping old database shape (actual database) until UI is refactored to use expanded shape', () => {
    const entry: ActualDatabaseEntry = {
      lo: 'lo1', // old shape 
      lo2: 'lo2' // current shape
    }
    const expected: IEntry = {
      ...entry,
      lo1: 'lo1', // current shape for lo
      local_orthography_1: 'lo1',
      local_orthography_2: 'lo2',
      senses: [],
    };
    expect(convert_and_expand_entry(entry)).toEqual(expected);
  });
});

/**
 * using ..entry can be removed if:
 * 1) entire front-end uses expanded format
 * 2) all fields are expanded or at least copied into expanded entry (including deprecated fields in sounds files like previousFileName) until completely refactored out of database
 * should still retain abbreviated translated fields (ps, sdn) as they lose their database value when expanded (because of translation into current language)
 */
function convert_and_expand_entry(entry: ActualDatabaseEntry): IEntry {
  const goal_database_entry = convert_entry_to_current_shape(entry);
  const expanded_entry = expand_entry(goal_database_entry);
  return {
    ...entry,
    ...goal_database_entry,
    ...expanded_entry
  };
}
