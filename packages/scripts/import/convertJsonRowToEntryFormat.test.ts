import {
  convertJsonRowToEntryFormat,
  returnArrayFromCommaSeparatedItems,
} from './convertJsonRowToEntryFormat.js';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';

describe('convertJsonRowToEntryFormat', () => {
  const fakeTimeStamp = 10101010;

  test('glosses', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphin',
        es_gloss: 'delfín',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "gl": {
            "es": "delfín",
          },
          "lx": "dolphin",
        },
      ]
    `);
  });

  test('example sentences', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphin',
        es_exampleSentence: 'el delfín nada en el océano.',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "gl": {},
          "lx": "dolphin",
          "xs": {
            "es": "el delfín nada en el océano.",
          },
        },
      ]
    `);
  });

  test('semantic domains', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphins',
        semanticDomain: '5.15',
        semanticDomain2: '1',
        semanticDomain_custom: 'the sea!',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "gl": {},
          "lx": "dolphins",
          "sd": [
            "the sea!",
          ],
          "sdn": [
            "5.15",
            "1",
          ],
        },
      ]
    `);
  });

  test('high-level conversion from csv', async () => {
    const dictionaryId = 'example-v4';
    const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8');
    const rows = parseCSVFrom(file);
    const rowsWithoutHeader = removeHeaderRow(rows);
    const entries = rowsWithoutHeader.map((row) =>
      convertJsonRowToEntryFormat(
        row,
        fakeTimeStamp,
        // eslint-disable-next-line no-undef
        fakeTimeStamp as unknown as FirebaseFirestore.FieldValue
      )
    );

    expect(entries).toEqual([
      {
        ca: 10101010,
        di: 'Modern Parisian French',
        gl: {
          en: 'car',
          es: 'auto',
        },
        ii: 'v4-10101010',
        lx: 'voiture',
        nt: 'small automobile',
        ph: 'vwatyʁ',
        ps: ['n', 'v'],
        sd: ['vehicle|cars'],
        sdn: ['5.15', '5'],
        ua: 10101010,
        xs: {
          en: 'I drive my car',
          es: 'Conduzco mi auto',
          vn: 'Je conduis ma voiture',
        },
      },
      {
        ca: 10101010,
        di: 'Modern Parisian French',
        gl: {
          en: 'tree',
          es: 'árbol',
        },
        ii: 'v4-10101010',
        lx: 'arbre',
        nt: 'generic term for all kinds of trees',
        ph: 'aʁbʁ',
        ps: ['n', 'adj'],
        scn: ['Acer rubrum'],
        sdn: ['1.4', '1.2'],
        ua: 10101010,
        xs: {
          en: 'The tree gives us shade',
          es: 'El árbol nos da sombra',
          vn: "L'arbre nous donne de l'ombre",
        },
      },
      {
        ca: 10101010,
        di: 'Modern Parisian French',
        gl: {
          en: 'tube',
          es: 'tubo',
        },
        ii: 'v4-10101010',
        lx: 'tube',
        nt: 'a cylindrical device for liquids',
        ph: 'tyb',
        pl: 'tubes',
        ps: ['n'],
        sd: ['plumbing'],
        sdn: ['5.9'],
        ua: 10101010,
        xs: {
          en: 'The water goes through the tubes',
          es: 'El agua pasa a través de los tubos',
          vn: "L'eau passe à travers les tubes",
        },
      },
      {
        ca: 10101010,
        di: 'Quebec French',
        gl: {
          en: 'car',
          es: 'auto',
        },
        ii: 'v4-10101010',
        lx: 'voiture',
        nt: 'small automobile',
        ph: 'vwɑtYʁ',
        ps: ['n'],
        sd: ['vehicle'],
        sdn: ['5.15'],
        sr: ['testing sources'],
        ua: 10101010,
        xs: {
          en: 'I drive my car',
          es: 'Conduzco mi auto',
          vn: 'Je conduis ma voiture',
        },
      },
      {
        ca: 10101010,
        di: 'Quebec French',
        gl: {
          en: 'neutral',
          es: 'neutro',
        },
        ii: 'v4-10101010',
        lx: 'neutre',
        ph: 'nøʏ̯tʁ̥',
        ps: ['adj'],
        ua: 10101010,
        xs: {
          en: 'My room is painted with a neutral color.',
          es: 'Mi habitación está pintada con un color neutro.',
          vn: "Ma chambre est peinte d'une couleur neutre.",
        },
      },
      {
        ca: 10101010,
        di: 'Quebec French',
        gl: {
          en: 'to celebrate',
          es: 'celebrar',
        },
        ii: 'v4-10101010',
        lx: 'fêter',
        nt: 'to have a party',
        ph: 'fɛɪ̯te',
        ps: ['v'],
        sr: ['test source', 'with multiples sources, test', 'https://example.com'],
        ua: 10101010,
        xs: {
          en: 'We will really party tonight',
          es: 'Vamos a celebrar esta noche',
          vn: 'On va vraiment fêter à soir',
        },
      },
      {
        ca: 10101010,
        di: 'Central Luganda',
        gl: {
          en: 'I will see you',
          es: 'Voy a verte',
        },
        ii: 'v4-10101010',
        in: '1SG-Fut-2SG-see-Fin.V',
        lx: 'njakulaba',
        mr: 'n-ja-ku-lab-a',
        ps: ['vp'],
        ua: 10101010,
      },
      {
        ca: 10101010,
        gl: {
          en: 'bye',
          es: 'adiós',
        },
        ii: 'v4-10101010',
        lx: 'vale',
        ua: 10101010,
      },
    ]);
  });

  test('does not duplicate vernacular', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        vernacular_exampleSentence: 'Hello world',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "gl": {},
          "lx": undefined,
          "xs": {
            "vn": "Hello world",
          },
        },
      ]
    `);
  });
});

function removeHeaderRow(rows: any[]) {
  return rows.splice(1);
}

describe('returnArrayFromCommaSeparatedItems', () => {
  test('splits two comma separated items into an array', () => {
    expect(returnArrayFromCommaSeparatedItems('n,v')).toStrictEqual(['n', 'v']);
  });
  test('handles unusual comma spacing', () => {
    expect(returnArrayFromCommaSeparatedItems('n, v ,adj')).toStrictEqual(['n', 'v', 'adj']);
  });
  test('returns empty array from undefined', () => {
    expect(returnArrayFromCommaSeparatedItems(undefined)).toStrictEqual([]);
  });
});
