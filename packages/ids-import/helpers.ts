function get_header_values(sheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function get_first_empty_column(header_values: string[]): number {
  const reversed_header_values = header_values.slice().reverse();
  return (
    header_values.length -
    reversed_header_values.findIndex((value) => {
      return value === '';
    })
  );
}

function create_unique_ids(chapter_id_column_values: any[], entry_id_column_values: any[]): any[][] {
  const concatenated_data_with_suffixes = [];
  const concatenated_freq = {};

  chapter_id_column_values.forEach((cell, i) => {
    const concatenated = cell + '-' + entry_id_column_values[i];
    if (concatenated_freq[concatenated] === undefined) {
      concatenated_freq[concatenated] = 1;
      concatenated_data_with_suffixes.push([concatenated]);
    } else {
      concatenated_freq[concatenated]++;
      const new_concatenated = concatenated + '-' + concatenated_freq[concatenated];
      concatenated_data_with_suffixes.push([new_concatenated]);
    }
  });

  return concatenated_data_with_suffixes;
}

if (import.meta.vitest) {
  describe(create_unique_ids, () => {
    test('start', () => {
      expect('a').toEqual('a');
    });
  });
}
