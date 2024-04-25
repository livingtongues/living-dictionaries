function prepareIDSDictionariesToBatchImport() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  const idsDataSheet = spreadsheet.getSheetByName('IDS Data')
  const semanticDomainsSheet = spreadsheet.getSheetByName('semantic domains')
  const sheets = spreadsheet.getSheets()
  sheets.forEach((sheet) => {
    if (checkSheet(sheet))
      return

    if (isTSVFile(sheet)) {
      modifyTSVHeaders(sheet)
      createIDToTSV(sheet)
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'SPANISH', glossName: 'es_gloss' })
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'FRENCH', glossName: 'fr_gloss' })
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'PORTUGUESE', glossName: 'pt_gloss' })
      copyGlossToTSV({ objectSheet: idsDataSheet, tsvSheet: sheet }, { idsGlossColumn: 'RUSSIAN', glossName: 'ru_gloss' })
      copySemanticDomainsToTSV({ tsvSheet: sheet, objectSheet: semanticDomainsSheet })
      // style details
      makeHeadersBold(sheet)
      sheet.setFrozenRows(1)
      highlightTargetedSemanticDomains(sheet)
    }
  })
}

function triggerManually() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  const semanticDomainsAdjustmentsSheet = spreadsheet.getSheetByName('IDS Adjustments for semantic domains')
  const idsDataSheet = spreadsheet.getSheetByName('IDS Data')
  const sheets = spreadsheet.getSheets()
  sheets.forEach((sheet) => {
    if (isTSVFile(sheet)) {
      if (sheet.getName().startsWith('A')) {
        Logger.log(`Starting semantic domain adjustments on ${sheet.getName()}`)
        adjustSemanticDomains({ objectSheet: semanticDomainsAdjustmentsSheet, tsvSheet: sheet })
        Logger.log(`Starting to fix translations on ${sheet.getName()}`)
        repairWrongTranslations({ objectSheet: idsDataSheet, tsvSheet: sheet })
      }
    }
  })
}
