function adjustSemanticDomains(sheet_info: SheetData): void {
  const { objectSheet: semanticDomainsAdjustmentsSheet, tsvSheet } = sheet_info;
  const data = tsvSheet.getRange('A1:1').getValues(); // Assuming the header is in the first row
  const tsv_semantic_domains_label_column_index = data[0].indexOf('semanticDomain') + 2; //* +2 because we need the second column: the one with the labels instead of the keys.
  const [
    english_gloss_sd_column_values,
    semantic_domains_key_column_values,
    semantic_domains_label_column_values,
    english_gloss_tsv_column_values,
    semantic_domains_tsv_column_values,
    semantic_domains_tsv_column_range
  ] = getValuesFromColumns([
    {
      from_sheet: semanticDomainsAdjustmentsSheet,
      columns: ['en_gloss', 'Semantic Domain Key', 'Semantic Domain Label']
    },
    {
      from_sheet: tsvSheet,
      columns: ['en_gloss', 'semanticDomain']
    },
    {
      from_sheet: tsvSheet,
      columns: [tsv_semantic_domains_label_column_index],
      are_columns_numbers: true,
      is_range: true
    }
  ]);

  let current_semantic_domain_index:number;
  english_gloss_tsv_column_values.forEach((cell, i) => {
    const matchIndex = english_gloss_sd_column_values.findIndex(value => {
      if (cell[0] === value[0]){
        current_semantic_domain_index = i
        Logger.log(`value: ${value}`)
        return value;
      }
    });
    if (matchIndex > -1 && (String(semantic_domains_tsv_column_values[current_semantic_domain_index] )!= String(semantic_domains_key_column_values[matchIndex]))) {
      const newValue = semantic_domains_label_column_values[matchIndex];
      Logger.log(`New Value: ${newValue}`)
      // Update the tsvSheet with the new value
      semantic_domains_tsv_column_range.getCell(current_semantic_domain_index + 1, 1).setValue(newValue); //* tsvSemanticDomainIndex + 1 because the semanticDomain is a merged header and the labels are in its second column
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
    spanish_column_range,
    french_column_range,
    portuguese_column_range,
    russian_column_range
  ] = getValuesFromColumns([
    {
      from_sheet: idsDataSheet,
      columns: ['ENGLISH', 'SPANISH', 'FRENCH', 'PORTUGUESE', 'RUSSIAN']
    },
    {
      from_sheet: tsvSheet,
      columns: ['en_gloss']
    },
    {
      from_sheet: tsvSheet,
      columns: ['es_gloss', 'fr_gloss', 'pt_gloss', 'ru_gloss'],
      is_range: true
    }
  ]);

  let current_row_index:number;
  english_gloss_values.forEach((cell, i) => {
    const matchIndex = english_values.findIndex(value => {
      if ((cell[0] === value[0]) && WRONG_TRANSLATIONS.includes(value[0])){
        Logger.log(`English value: ${value}`)
        current_row_index = i;
        return value;
      }
    });
    if (matchIndex > -1) {
      // get the new values
      const new_spanish_value = spanish_values[matchIndex];
      const new_french_value = french_values[matchIndex];
      const new_portuguese_value = portuguese_values[matchIndex];
      const new_russian_value = russian_values[matchIndex];
      // set the new values to the target columns
      spanish_column_range?.getCell(current_row_index + 1, 1).setValue(new_spanish_value);
      french_column_range?.getCell(current_row_index + 1, 1).setValue(new_french_value);
      portuguese_column_range?.getCell(current_row_index + 1, 1).setValue(new_portuguese_value);
      russian_column_range?.getCell(current_row_index + 1, 1).setValue(new_russian_value);
    }
  });
}
