import { prepareMainTranslationsFromSpreadsheet, jsonFromLocalCsv, getSectionTranslationsFromSpreadsheet } from './update-locales';
import path from 'node:path'

describe(prepareMainTranslationsFromSpreadsheet, () => {
  
  test('parses correctly', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './App-Translations.csv'));
    const translations = prepareMainTranslationsFromSpreadsheet(rows);
    expect(translations.en.page.direction).toBe('ltr');
    expect(translations.he.page.direction).toBe('rtl');
    expect(translations.en.about.about_LD).toBe('About Living Dictionaries');
    expect(translations.es.about.about_LD).toBe('Acerca de Diccionarios Vivos');
  });

  test('ignores rows without component and item specified', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './App-Translations.csv'));
    const translations = prepareMainTranslationsFromSpreadsheet(rows);
    expect(translations.en).toEqual({
      "about": {
        "about_LD": "About Living Dictionaries",
      },
      "page": {
        "direction": "ltr",
      },
    })
  });
});

describe(getSectionTranslationsFromSpreadsheet, () => {
  test('prefixes glossing languages', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './Glossing-Languages.csv'));
    const translations = getSectionTranslationsFromSpreadsheet(rows, { section: 'gl' });
    expect(translations.en.gl.aa).toBe('Afar');
    expect(translations.es.gl.aa).toBe('Lejos');
    expect(translations).toMatchInlineSnapshot(`
      {
        "am": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "ar": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "as": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "bn": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "en": {
          "gl": {
            "aa": "Afar",
            "en": "English",
          },
        },
        "es": {
          "gl": {
            "aa": "Lejos",
            "en": "inglés",
          },
        },
        "fr": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "ha": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "he": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "hi": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "id": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "ms": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "or": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "pt": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "ru": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "sw": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "vi": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
        "zh": {
          "gl": {
            "aa": "",
            "en": "",
          },
        },
      }
    `);
  });

  test('prefixes parts of speech', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './Parts-of-Speech.csv'));
    const translations = getSectionTranslationsFromSpreadsheet(rows, { section: 'ps' });
    expect(translations.en.ps.n).toBe('noun');
    expect(translations.es.ps.n).toBe('sustantivo');
  });

  test('prefixes parts of speech abbreviations', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './Parts-of-Speech.csv'));
    const translations = getSectionTranslationsFromSpreadsheet(rows, { section: 'psAbbrev' });
    expect(translations.en.psAbbrev.n).toBe('n');
    expect(translations.es.psAbbrev.n).toBe('s');
  });

  test('prefixes semantic domains', async () => {
    const rows = await jsonFromLocalCsv(path.join(__dirname, './Semantic-Domains.csv'));
    const translations = getSectionTranslationsFromSpreadsheet(rows, { section: 'sd' });
    expect(translations.en.sd['1.0']).toBe('Universe and the natural world');
    expect(translations.es.sd['1.0']).toBe('El universo y el mundo natural');
  });
})



