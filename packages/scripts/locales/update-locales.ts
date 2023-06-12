import fetch from 'node-fetch';
import csv from 'csvtojson';
import dot from 'dot-object';
import { promises as fs } from 'fs';
import { ReadyLocales, UnpublishedLocales } from '@living-dictionaries/types/languages.interface.js';
import { type IGlossLanguage } from '@living-dictionaries/types';
const languages = [...Object.keys(ReadyLocales), ...Object.keys(UnpublishedLocales)];

export async function generateFilesFromSpreadsheet() {
  const i18nGoogleSheetId = '1SqtfUvYYAEQSFTaTPoAJq6k-wlbuAgWCkswE_kiUhLs';
  const localesDir = '../site/src/locales';
  try {
    const rows = await jsonFromCsvUrl(googleSheetCsvUrl(i18nGoogleSheetId, 'App-Translations'));
    const translations = await generateTranslationsFromSpreadsheet(rows, { nesting: 'deep' });
    await writeLocaleFiles(translations, localesDir);

    const rows_sd = await jsonFromCsvUrl(googleSheetCsvUrl(i18nGoogleSheetId, 'Semantic-Domains'));
    const translations_sd = await generateTranslationsFromSpreadsheet(rows_sd, { prefix: 'sd' });
    await writeLocaleFiles(translations_sd, localesDir + '/sd');

    const rows_ps = await jsonFromCsvUrl(googleSheetCsvUrl(i18nGoogleSheetId, 'Parts-of-Speech'));
    const translations_ps = await generateTranslationsFromSpreadsheet(rows_ps, { prefix: 'ps' });
    await writeLocaleFiles(translations_ps,  localesDir + '/ps');
    const translations_psAbbrev = await generateTranslationsFromSpreadsheet(rows_ps, {
      prefix: 'psAbbrev',
    });
    await writeLocaleFiles(translations_psAbbrev, localesDir + '/psAbbrev');

    const rows_gl = await jsonFromCsvUrl(
      googleSheetCsvUrl(i18nGoogleSheetId, 'Glossing-Languages')
    );
    const translations_gl = await generateTranslationsFromSpreadsheet(rows_gl, { prefix: 'gl' });
    await writeLocaleFiles(translations_gl, localesDir + '/gl');
    const glossingLanguages = await generateGlossingLanguages(rows_gl);
    await fs.writeFile(
      `../site/src/lib/glosses/glossing-languages-list.json`,
      JSON.stringify(glossingLanguages, null, 2) + '\r\n'
    );
    console.log('glossing-languages-list.json file written');
  } catch (error) {
    throw new Error(error.message);
  }
}
generateFilesFromSpreadsheet();

export const generateTranslationsFromSpreadsheet: (
  rows: any[],
  options?: {
    nesting?: 'shallow' | 'deep';
    prefix?: string;
  }
) => Record<string, unknown> = (rows, options = {}) => {
  const translations = {};

  languages.forEach((lang) => {
    translations[lang] = {};

    rows.forEach((row) => {
      const key = row.key;
      const langColumn = options.prefix === 'psAbbrev' ? lang + 'Abbrev' : lang;
      const value = row[langColumn];
      if (key && value) {
        if (options.nesting === 'deep') 
          dot.str(key, value, translations[lang]); // doesn't work with dot.str('1.1', "Sky, weather and climate", translations['en'])
        else 
          translations[lang][key] = value;
        
      }
    });

    if (options.prefix) 
      translations[lang] = { [options.prefix]: translations[lang] };
    
  });

  return translations;
};

async function generateGlossingLanguages(rows: any[]) {
  const glossingLanguages = {};
  rows.forEach((row) => {
    const language: IGlossLanguage = {};
    for (const column of ['vernacularName', 'vernacularAlternate', 'internalName', 'useKeyboard']) {
      if (row[column].length) 
        language[column] = row[column];
      
    }
    if (row.showKeyboard == 'true') 
      language.showKeyboard = true;
    
    glossingLanguages[row.key] = language;
  });
  return glossingLanguages;
}

export async function jsonFromLocalCsv(path: string) {
  return await csv().fromFile(path);
}

async function jsonFromCsvUrl(url: string) {
  const csvResponse = await fetch(url);
  const csvString = await csvResponse.text();
  return await csv().fromString(csvString);
}

function googleSheetCsvUrl(spreadsheetId: string, sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
}

async function writeLocaleFiles(translations: Record<string, any>, directory: string) {
  const languagesToWrite = languages.map(async (lang) => {
    const path = `${directory}/${lang}.json`;
    return fs.writeFile(path, JSON.stringify(translations[lang], null, 2) + '\r\n');
  });
  await Promise.all(languagesToWrite);
  console.log('locale files written to ' + directory);
}
