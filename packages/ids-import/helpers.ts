// @ts-expect-error - GoogleAppsScript magic
function get_header_values(sheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
}

function get_first_empty_column(header_values: string[]): number {
  return header_values.length + 1
}

// @ts-expect-error - GoogleAppsScript magic
function getValuesFromColumns(values_from_columns: ValuesFromColumns[]): string[][][] | GoogleAppsScript.Spreadsheet.Range[] {
  const values = []
  values_from_columns.forEach((element) => {
    const { from_sheet, columns, are_columns_numbers, is_range } = element
    const header_values = get_header_values(from_sheet)
    columns.forEach((column) => {
      const columnIndex = are_columns_numbers ? column : header_values.indexOf(column) + 1
      if (columnIndex > 0) {
        const ranges = from_sheet.getRange(
          2,
          columnIndex,
          from_sheet.getLastRow() - 1,
          1,
        )
        if (is_range)
          values.push(ranges)
        else
          values.push(ranges.getValues())
      }
    })
  })
  return values
}

function create_unique_ids(chapter_id_column_values: any[], entry_id_column_values: any[]): any[][] {
  const concatenated_data_with_suffixes = []
  const concatenated_freq = {}

  chapter_id_column_values.forEach((cell, i) => {
    const prefix = Number(cell) <= 9 ? '0' : ''
    const concatenated = `${prefix}${cell}.${entry_id_column_values[i]}`

    if (concatenated_freq[concatenated] === undefined) {
      concatenated_freq[concatenated] = 1
      concatenated_data_with_suffixes.push([concatenated])
    } else {
      concatenated_freq[concatenated]++
      const new_concatenated = `${concatenated}-${concatenated_freq[concatenated]}`
      concatenated_data_with_suffixes.push([new_concatenated])
    }
  })

  return concatenated_data_with_suffixes
}

if (import.meta.vitest) {
  test(get_header_values, () => {
    const mockSheet = {
      getLastColumn: () => 2,
      getRange: (row: number, col: number, numRows: number, numCols: number) => ({
        getValues: () => [['header1', 'header2']],
      }),
    }
    expect(get_header_values(mockSheet)).toEqual(
      [
        'header1',
        'header2',
      ],
    )
  })

  test(get_first_empty_column, () => {
    const header_values = ['chapter_id', 'entry_id', 'meaning', 'Example_Phonemic', 'comment']
    expect(get_first_empty_column(header_values)).toEqual(6)
  })

  test(getValuesFromColumns, () => {
    const mockSheet = {
      getLastRow: () => 2,
      getLastColumn: () => 3,
      getRange: (row: number, col: number, numRows: number, numCols: number) => {
        const columnValues = [
          [['column1-value1'], ['column1-value2']],
          [['column2-value1'], ['column2-value2']],
          [['column3-range1'], ['column3-range2']],
        ]
        return {
          getValues: () => columnValues[col - 1],
        }
      },
    }
    expect(getValuesFromColumns([
      {
        from_sheet: mockSheet,
        columns: [1, 2],
        are_columns_numbers: true,
      },
      {
        from_sheet: mockSheet,
        columns: [3],
        are_columns_numbers: true,
        is_range: true,
      },
    ])).toEqual(
      [
        [
          [
            'column1-value1',
          ],
          [
            'column1-value2',
          ],
        ],
        [
          [
            'column2-value1',
          ],
          [
            'column2-value2',
          ],
        ],
        {
          getValues: expect.any(Function),
        },
      ],
    )
  })

  test(create_unique_ids, () => {
    expect(create_unique_ids(['1', '9', '13', '1'], ['123', '234', '345', '123'])).toEqual(
      [
        [
          '01.123',
        ],
        [
          '09.234',
        ],
        [
          '13.345',
        ],
        [
          '01.123-2',
        ],
      ],
    )
  })
}
