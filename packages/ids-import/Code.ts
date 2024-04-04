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
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'SPANISH', glossName: 'es_gloss' });
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'FRENCH', glossName: 'fr_gloss' });
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'PORTUGUESE', glossName: 'pt_gloss' });
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'RUSSIAN', glossName: 'ru_gloss' });
      copySemanticDomainsToTSV({ tsvSheet: sheet, objectSheet: semanticDomainsSheet });
      // style details
      makeHeadersBold(sheet);
      sheet.setFrozenRows(1);
      highlightTargetedSemanticDomains(sheet);
    }
  });
}

function triggerManually() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const semanticDomainsAdjustmentsSheet = spreadsheet.getSheetByName('IDS Adjustments for semantic domains');
  const idsDataSheet = spreadsheet.getSheetByName('IDS Data');
  const testTsvSheet = spreadsheet.getSheetByName('test_tsv');
  adjustSemanticDomains({ objectSheet: semanticDomainsAdjustmentsSheet, tsvSheet: testTsvSheet }); //TODO change testTsvSheet for real tsv sheets
  repairWrongTranslations({ objectSheet: idsDataSheet, tsvSheet: testTsvSheet }); //TODO change testTsvSheet for real tsv sheets
}
