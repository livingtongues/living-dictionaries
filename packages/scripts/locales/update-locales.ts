import fetch from 'node-fetch';
import csv from 'csvtojson';
import dot from 'dot-object';
import { promises as fs } from 'fs';
import { Locales, UnpublishedLocales } from '../../site/src/lib/i18n/locales.js';
import { type IGlossLanguage } from '@living-dictionaries/types';
const languages = [...Object.keys(Locales), ...Object.keys(UnpublishedLocales)];

const I18N_GOOGLE_SHEET_ID = '1SqtfUvYYAEQSFTaTPoAJq6k-wlbuAgWCkswE_kiUhLs';
const LOCALES_DIRECTORY = '../site/src/lib/i18n/locales';

export async function generateFilesFromSpreadsheet() {
  const rows = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'App-Translations'));
  const translations = generateTranslationsFromSpreadsheet(rows, { nesting: 'deep' });
  await writeLocaleFiles(translations, LOCALES_DIRECTORY);

  const rows_sd = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Semantic-Domains'));
  const translations_sd = generateTranslationsFromSpreadsheet(rows_sd, { prefix: 'sd' });
  await writeLocaleFiles(translations_sd, LOCALES_DIRECTORY + '/sd');

  const rows_ps = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Parts-of-Speech'));
  const translations_ps = generateTranslationsFromSpreadsheet(rows_ps, { prefix: 'ps' });
  await writeLocaleFiles(translations_ps, LOCALES_DIRECTORY + '/ps');
  const translations_psAbbrev = generateTranslationsFromSpreadsheet(rows_ps, { prefix: 'psAbbrev' });
  await writeLocaleFiles(translations_psAbbrev, LOCALES_DIRECTORY + '/psAbbrev');

  const rows_gl = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Glossing-Languages'));
  const translations_gl = generateTranslationsFromSpreadsheet(rows_gl, { prefix: 'gl' });
  await writeLocaleFiles(translations_gl, LOCALES_DIRECTORY + '/gl');
  
  const glossingLanguages = await generateGlossingLanguages(rows_gl);
  await fs.writeFile(
    `../site/src/lib/glosses/glossing-languages-list.json`,
    JSON.stringify(glossingLanguages, null, 2) + '\r\n'
  );
  console.log('glossing-languages-list.json file written');
}

generateFilesFromSpreadsheet();

export const generateTranslationsFromSpreadsheet: (
  rows: any[],
  options?: {
    nesting?: 'shallow' | 'deep';
    prefix?: string;
  }
) => Record<string, unknown> = (rows, options = {}) => {
  const translations: Record<string, any> = {};

  languages.forEach((lang) => {
    translations[lang] = {};

    rows.forEach((row) => {
      const { key } = row;
      const langColumn = options.prefix === 'psAbbrev' ? lang + 'Abbrev' : lang;
      const value = row[langColumn] || '';
      if (key) {
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

function getGoogleSheetCsvUrl(spreadsheetId: string, sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
}

async function writeLocaleFiles(translations: Record<string, any>, directory: string) {
  const languagesToWrite = languages.map(async (lang) => {
    const path = `${directory}/${lang}.js`;
    const typings = lang === 'en' ? '' : `/** @type {typeof import('./en.js').default} */\r\n`;
    const content = `${typings}export default ${JSON.stringify(translations[lang], null, 2)}
`
    return fs.writeFile(path, content);
  });
  await Promise.all(languagesToWrite);
  console.log('locale files written to ' + directory);
}
