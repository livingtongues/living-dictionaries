function adjustSemanticDomains(sheet_info: SheetData): void {
  const { objectSheet: semanticDomainsAdjustmentsSheet, tsvSheet } = sheet_info;


  const [
    english_gloss_sd_column_values,
    semantic_domains_label_column_values,
    english_gloss_tsv_column_values
  ] = getValuesFromColumns([
    {
      from_sheet: semanticDomainsAdjustmentsSheet,
      columns: ['en_gloss', 'Semantic Domain Label']
    },
    {
      from_sheet: tsvSheet,
      columns: ['en_gloss']
    }
  ]);

  english_gloss_tsv_column_values.forEach((cell, i) => {
    const matchIndex = english_gloss_tsv_column_values.indexOf(cell);
    if (english_gloss_tsv_column_values.includes(cell)) {
      // Log the value if it matches
      Logger.log(cell);
    }
  })
}
