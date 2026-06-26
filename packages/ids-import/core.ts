// @ts-expect-error
function checkSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet): boolean {
  const [headerRow] = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()
  return headerRow.includes('en_gloss')
}

// @ts-expect-error
function isTSVFile(sheet: GoogleAppsScript.Spreadsheet.Sheet): boolean {
  const sheetName = sheet.getName()
  return sheetName.endsWith('_tsv')
}

// @ts-expect-error
function makeHeadersBold(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn())
  headerRange.setFontWeight('bold')
}

// @ts-expect-error
function modifyTSVHeaders(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const [header_row] = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()
  const modified_rows = header_row.map((hr) => {
    if (hr === 'comment') hr = 'notes'
    else if (hr === 'meaning') hr = 'en_gloss'
    else if (hr.endsWith('_Phonemic')) hr = 'lexeme'
    return hr
  })
  sheet.getRange(1, 1, 1, modified_rows.length).setValues([modified_rows])
}

// @ts-expect-error
function highlightTargetedSemanticDomains(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const targeted_sematic_domains = ['1.5', '2.1', '5.4', '1.4', '6', '9', '2.3', '3.2', '5.9']
  const highlight_color = '#ffe599'
  const [header_row] = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()
  const semantic_domains_column = header_row.indexOf('semanticDomain') + 1

  if (semantic_domains_column > 0) {
    const semantic_domains_key_column_values = sheet.getRange(2, semantic_domains_column, sheet.getLastRow() - 1, 1).getValues()
    semantic_domains_key_column_values.forEach((cell, index) => {
      const cell_value = cell[0].toString()
      if (targeted_sematic_domains.includes(cell_value))
        sheet.getRange(index + 2, semantic_domains_column).setBackground(highlight_color)
    })
  }
}

function copyGlossToTSV(sheet_info: SheetData, gloss_data: GlossData): void {
  const { idsGlossColumn, glossName } = gloss_data
  const { objectSheet: idsDataSheet, tsvSheet } = sheet_info
  const tsv_header_values = get_header_values(tsvSheet)
  const first_empty_column = get_first_empty_column(tsv_header_values)
  const [
    ids_id_column_values,
    ids_gloss_column_values,
    entry_id_column_values,
    chapter_id_column_values,
    first_empty_column_range,
  ] = getValuesFromColumns([
    {
      from_sheet: idsDataSheet,
      columns: ['IDS_ID', idsGlossColumn],
    },
    {
      from_sheet: tsvSheet,
      columns: ['entry_id', 'chapter_id'],
    },
    {
      from_sheet: tsvSheet,
      columns: [first_empty_column],
      are_columns_numbers: true,
      is_range: true,
    },
  ])

  chapter_id_column_values.forEach((cell, i) => {
    const lookupValue = `${cell[0]}-${entry_id_column_values[i][0]}`
    const match_index = ids_id_column_values.findIndex(value => value[0] === lookupValue)
    if (match_index !== -1)
      first_empty_column_range.getCell(i + 1, 1).setValue(ids_gloss_column_values[match_index][0])
  })

  tsvSheet.getRange(1, first_empty_column, 1, 1).setValue(glossName)
}

// @ts-expect-error
function createIDToTSV(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const header_values = get_header_values(sheet)
  const first_empty_column = get_first_empty_column(header_values)
  const [
    chapter_id_column_values,
    entry_id_column_values,
    first_empty_column_range,
  ] = getValuesFromColumns([
    {
      from_sheet: sheet,
      columns: ['chapter_id', 'entry_id'],
    },
    {
      from_sheet: sheet,
      columns: [first_empty_column],
      are_columns_numbers: true,
      is_range: true,
    },
  ])

  const concatenated_data_with_suffixes = create_unique_ids(chapter_id_column_values, entry_id_column_values)
  first_empty_column_range.setNumberFormat('@') // converts the entire column in a text column.

  first_empty_column_range.setValues(concatenated_data_with_suffixes)
  sheet.getRange(1, first_empty_column, 1, 1).setValue('ID')
}

function copySemanticDomainsToTSV(sheet_info: SheetData): void {
  const { objectSheet: semanticDomainsSheet, tsvSheet } = sheet_info
  const first_empty_column = get_first_empty_column(get_header_values(tsvSheet))
  const [
    semantic_domains_label_column_values,
    ids_semantic_domains_equivalent_column_values,
    chapter_id_column_values,
    semantic_domains_range,
    first_empty_column_range,
    second_empty_column_range,
  ] = getValuesFromColumns([
    {
      from_sheet: semanticDomainsSheet,
      columns: ['Semantic Domain', 'IDS Chapter Equivalent'],
    },
    {
      from_sheet: tsvSheet,
      columns: ['chapter_id'],
    },
    {
      from_sheet: semanticDomainsSheet,
      columns: ['Semantic Domain'],
      is_range: true,
    },
    {
      from_sheet: tsvSheet,
      columns: [first_empty_column, first_empty_column + 1],
      are_columns_numbers: true,
      is_range: true,
    },
  ])

  // @ts-expect-error - GoogleAppsScript magic
  const dropdown_rule = SpreadsheetApp.newDataValidation().requireValueInRange(semantic_domains_range).build()
  tsvSheet.getRange(1, first_empty_column, 1, 2).setValue('semanticDomain').mergeAcross() // Merge with the next column
  second_empty_column_range.setDataValidation(dropdown_rule)
  chapter_id_column_values.forEach((cell, i) => {
    const match_index = ids_semantic_domains_equivalent_column_values.findIndex(value =>
      // eslint-disable-next-line eqeqeq -- sometimes is string or number
      value[0].split(',').some(num => num == cell[0]),
    )
    if (match_index !== -1) {
      first_empty_column_range
        .getCell(i + 1, 1)
        .setFormula(
          `=IF(ISTEXT(${second_empty_column_range.getCell(i + 1, 1).getA1Notation()}),VLOOKUP(${second_empty_column_range
            .getCell(i + 1, 1)
            .getA1Notation()}, 'semantic domains'!$A$3:$B$1004, 2, FALSE),"")`,
        )
      second_empty_column_range.getCell(i + 1, 1).setValue(semantic_domains_label_column_values[match_index][0])
    }
  })
}
