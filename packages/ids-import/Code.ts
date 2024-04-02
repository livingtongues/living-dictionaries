function prepareIDSDictionariesToBatchImport() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const idsDataSheet = spreadsheet.getSheetByName('IDS Data');
  const semanticDomainsSheet = spreadsheet.getSheetByName('semantic domains');
  const sheets = spreadsheet.getSheets();
  sheets.forEach((sheet) => {
    if (checkSheet(sheet))
      return;

    if (isTSVFile(sheet)) {
      modifyTSVHeaders(sheet);
      createIDToTSV(sheet);
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'SPANISH', glossName: 'es_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'FRENCH', glossName: 'fr_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'PORTUGUESE', glossName: 'pt_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'RUSSIAN', glossName: 'ru_gloss' });
      copySemanticDomainsToTSV({ tsvSheet: sheet, semanticDomainsSheet });
      // style details
      makeHeadersBold(sheet);
      sheet.setFrozenRows(1);
      highlightTargetedSemanticDomains(sheet);
    }
  });
}
