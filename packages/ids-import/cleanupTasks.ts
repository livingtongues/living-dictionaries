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
      if (cell[0] === value[0]){
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
      tsvSheet.getRange(i + 2, tsvSemanticDomainIndex + 1).setValue(newValue); //* tsvSemanticDomainIndex + 1 because the semanticDomain is a merged header and the labels are in its second column
    }
  });
}

const WRONG_TRANSLATIONS = ['often', 'always', 'ready', 'cease, stop', 'finish', 'end (temporal)', 'last, endure', 'begin, beginning', 'retard, delay', 'hasten, hurry', 'slow', 'swift, fast, quick', 'immediately', 'now', 'late', 'early', 'old', 'young', 'age', 'new', 'time', 'three times', 'third', 'two times', 'pair', 'second', 'last', 'first', 'alone, only', 'half', 'part, piece', 'empty', 'full', 'multitude, crowd'];
function repairWrongTranslations (sheet_info: SheetData): void {
  const { objectSheet: idsDataSheet, tsvSheet } = sheet_info;
  const [
    english_values,
    spanish_values,
    french_values,
    portuguese_values,
    russian_values,
    english_gloss_values,
  ] = getValuesFromColumns([
    {
      from_sheet: idsDataSheet,
      columns: ['ENGLISH', 'SPANISH', 'FRENCH', 'PORTUGUESE', 'RUSSIAN']
    },
    {
      from_sheet: tsvSheet,
      columns: ['en_gloss']
    }
  ]);

  english_gloss_values.forEach((cell, i) => {
    const matchIndex = english_values.findIndex(value => {
      if ((cell[0] === value[0]) && WRONG_TRANSLATIONS.includes(value[0])){
        Logger.log(`cell: ${cell}`)
        Logger.log(`value: ${value}`)
        return value;
      }
    });
    if (matchIndex > -1) {
      // get all columns to change
      const spanish_column = tsvSheet.getRange('A1:1').getValues()[0].indexOf('es_gloss') + 1;
      const french_column = tsvSheet.getRange('A1:1').getValues()[0].indexOf('fr_gloss') + 1;
      const portuguese_column = tsvSheet.getRange('A1:1').getValues()[0].indexOf('pt_gloss') + 1;
      const russian_column = tsvSheet.getRange('A1:1').getValues()[0].indexOf('ru_gloss') + 1;
      // get the new values
      const new_spanish_value = spanish_values[matchIndex];
      const new_french_value = french_values[matchIndex];
      const new_portuguese_value = portuguese_values[matchIndex];
      const new_russian_value = russian_values[matchIndex];
      // set the new values to the target columns
      if (spanish_column)
        tsvSheet.getRange(i + 2, spanish_column).setValue(new_spanish_value); // Not sure why I need to add two to the rows index, it might be due to the headers.
      if (french_column)
        tsvSheet.getRange(i + 2, french_column).setValue(new_french_value); // Not sure why I need to add two to the rows index, it might be due to the headers.
      if (portuguese_column)
        tsvSheet.getRange(i + 2, portuguese_column).setValue(new_portuguese_value); // Not sure why I need to add two to the rows index, it might be due to the headers.
      if (russian_column)
        tsvSheet.getRange(i + 2, russian_column).setValue(new_russian_value); // Not sure why I need to add two to the rows index, it might be due to the headers.
    }
  });
}
