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
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'H', glossName: 'es_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'I', glossName: 'fr_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'J', glossName: 'po_gloss' });
      copyGlossToTSV({ idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'K', glossName: 'ru_gloss' });
      copySemanticDomainsToTSV({ tsvSheet: sheet, semanticDomainsSheet });
      // style details
      makeHeadersBold(sheet);
      sheet.setFrozenRows(1);
      highlightTargetedSemanticDomains(sheet);
    }
  });
}
