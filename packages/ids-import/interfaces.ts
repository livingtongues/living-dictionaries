interface GlossData {
  idsGlossColumn: string
  glossName: string
}

interface SheetData {
  // @ts-expect-error - GoogleAppsScript magic
  tsvSheet: GoogleAppsScript.Spreadsheet.Sheet
  // @ts-expect-error - GoogleAppsScript magic
  objectSheet: GoogleAppsScript.Spreadsheet.Sheet
}

interface ValuesFromColumns {
  // @ts-expect-error - GoogleAppsScript magic
  from_sheet: GoogleAppsScript.Spreadsheet.Sheet
  columns: string[] | number[]
  are_columns_numbers?: boolean
  is_range?: boolean
}
