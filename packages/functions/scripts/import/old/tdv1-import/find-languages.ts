/**
 * Logs unique glossing languages and throw an error if any are found that aren't supported in our current set of glossing languages
 */
export const findLanguages = (data: any[]) => {
  const uniqueLanguages: string[] = [];
  const unmatchedLanguages: string[] = [];
  console.log(''); // spacer

  for (const row of data) {
    if (row.gloss) {
      const language = 'en';
      if (uniqueLanguages.indexOf(language) === -1) uniqueLanguages.push(language);
    }
    Object.keys(row).forEach((key) => {
      // Except for English, gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
      if (key.includes('_gloss') && row[key]) {
        const language = key.split('_gloss')[0];
        if (uniqueLanguages.indexOf(language) === -1) uniqueLanguages.push(language);
      }
    });
  }
  uniqueLanguages.forEach((lang: string) => {
    const matched = glossingLanguages.some((glossingLanguage) => {
      return glossingLanguage.bcp47 === lang;
    });
    if (matched) {
      console.log('Matched glossing language: ', lang);
    } else {
      console.log('>> Unmatched glossing language: ', lang);
      unmatchedLanguages.push(lang);
    }
  });
  console.log(''); // spacer

  if (unmatchedLanguages.length) {
    throw new Error(`Found unsupported glossing language(s). See log`);
  }
  return uniqueLanguages;
};
