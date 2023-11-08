import fetch from 'node-fetch';
import csv from 'csvtojson';
import { promises as fs } from 'fs';
import { Locales, UnpublishedLocales } from '../../site/src/lib/i18n/locales.js';
import { type IGlossLanguage } from '@living-dictionaries/types';
const languages = [...Object.keys(Locales), ...Object.keys(UnpublishedLocales)];

const I18N_GOOGLE_SHEET_ID = '1SqtfUvYYAEQSFTaTPoAJq6k-wlbuAgWCkswE_kiUhLs';
const LOCALES_DIRECTORY = '../site/src/lib/i18n/locales';

export async function generateFilesFromSpreadsheet() {
  const rows = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'App-Translations'));
  const translations = prepareMainTranslationsFromSpreadsheet(rows);
  await writeLocaleFiles(translations, LOCALES_DIRECTORY);

  const rows_sd = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Semantic-Domains'));
  const translations_sd = getSectionTranslationsFromSpreadsheet(rows_sd, { section: 'sd' });
  await writeLocaleFiles(translations_sd, LOCALES_DIRECTORY + '/sd');

  const rows_ps = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Parts-of-Speech'));
  const translations_ps = getSectionTranslationsFromSpreadsheet(rows_ps, { section: 'ps' });
  await writeLocaleFiles(translations_ps, LOCALES_DIRECTORY + '/ps');
  const translations_psAbbrev = getSectionTranslationsFromSpreadsheet(rows_ps, { section: 'psAbbrev' });
  await writeLocaleFiles(translations_psAbbrev, LOCALES_DIRECTORY + '/psAbbrev');

  const rows_gl = await jsonFromCsvUrl(getGoogleSheetCsvUrl(I18N_GOOGLE_SHEET_ID, 'Glossing-Languages'));
  const translations_gl = getSectionTranslationsFromSpreadsheet(rows_gl, { section: 'gl' });
  await writeLocaleFiles(translations_gl, LOCALES_DIRECTORY + '/gl');
  
  const glossingLanguages = await generateGlossingLanguages(rows_gl);
  await fs.writeFile(
    `../site/src/lib/glosses/glossing-languages-list.json`,
    JSON.stringify(glossingLanguages, null, 2) + '\r\n'
  );
  console.log('glossing-languages-list.json file written');
}

generateFilesFromSpreadsheet();

interface AllTranslations {
  [languageBCP47: string]: TranslationsForLanguage
}

interface TranslationsForLanguage {
  [component: string]: {
    [item: string]: string;
  }
}

export const prepareMainTranslationsFromSpreadsheet = (rows: Record<string | 'component' | 'item', string>[]) => {
  const translations: AllTranslations = {};
  
  languages.forEach((lang) => {
    const translationsForLanguage: TranslationsForLanguage = {};
    rows.forEach((row) => {
      const { component, item } = row;
      if (!component || !item) return;

      const value = row[lang] || '';
      if (!translationsForLanguage[component]) {
        translationsForLanguage[component] = {};
      }
      translationsForLanguage[component][item] = value;
    });

    translations[lang] = translationsForLanguage;
  });

  return translations;
}

// glosses, parts of speech, semantic domains
export const getSectionTranslationsFromSpreadsheet = (rows: Record<string | 'key', string>[], options: { section: 'gl' | 'ps' | 'psAbbrev' | 'sd' }) => {
  const translations: AllTranslations = {};

  languages.forEach((lang) => {
    const translationsForSection: { [key: string]: string } = {};
    
    const langColumn = 
      options.section === 'psAbbrev' 
        ? lang + 'Abbrev' 
        : lang;

    rows.forEach((row) => {
      const { key } = row;
      if (!key) return;

      const value = row[langColumn] || '';
      translationsForSection[key] = value;
    });

    translations[lang] = { [options.section]: translationsForSection };
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
