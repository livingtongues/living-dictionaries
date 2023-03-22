import type { ActualDatabaseEntry, IEntry } from "@living-dictionaries/types";

describe('apply_convert_expand', () => {
  test('updates entry shape while keeping old shape until UI is refactored to use expanded shape', () => {
    const entry: ActualDatabaseEntry = {}
    const expected: IEntry = {};
    expect(apply_convert_expand_entry(entry)).toEqual(expected);
  });
});