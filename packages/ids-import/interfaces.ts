interface GlossData {
  idsGlossColumn: string;
  glossName: string;
}

interface GlossesSheetData {
  tsvSheet: GoogleAppsScript.Spreadsheet.Sheet;
  idsDataSheet: GoogleAppsScript.Spreadsheet.Sheet;
}

interface SemanticDomainsSheetData {
  tsvSheet: GoogleAppsScript.Spreadsheet.Sheet;
  semanticDomainsSheet: GoogleAppsScript.Spreadsheet.Sheet;
}

interface ValuesFromColumns {
  from_sheet: GoogleAppsScript.Spreadsheet.Sheet,
  columns: string[] | number[],
  are_columns_numbers?: boolean,
  is_range?: boolean
}
