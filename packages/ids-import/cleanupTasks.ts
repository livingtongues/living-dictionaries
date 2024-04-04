function adjustSemanticDomains(sheet_info: SheetData): void {
  const { objectSheet: semanticDomainsAdjustmentsSheet, tsvSheet } = sheet_info;


  const [
    english_gloss_sd_column_values,
    semantic_domains_label_column_values,
    english_gloss_tsv_column_values,
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
    const matchIndex = english_gloss_sd_column_values.findIndex(value => {
      if (JSON.stringify(cell).trim() === JSON.stringify(value).trim()){
        Logger.log(`cell: ${cell}`)
        Logger.log(`value: ${value}`)
        return value;
      }
    });
    if (matchIndex > -1) {
      const tsvSemanticDomainIndex = tsvSheet.getRange('A1:1').getValues()[0].indexOf('semanticDomain') + 1;
      const newValue = semantic_domains_label_column_values[matchIndex];
      Logger.log(`New Value: ${newValue}`)
      // Update the tsvSheet with the new value
      tsvSheet.getRange(i + 1, tsvSemanticDomainIndex + 1).setValue(newValue);
    }
  });
}
