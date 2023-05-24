import {
  convertJsonRowToEntryFormat,
  returnArrayFromCommaSeparatedItems,
} from './convertJsonRowToEntryFormat.js';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';

// TODO
// step 1: change all tests
// step 2: make the tests pass

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

    expect(entries).toEqual([
      {
        sn: [
          {
            gl: { es: 'delfín' },
            xs: [{}],
          },
        ],
        lx: 'dolphin',
      },
    ]);
  });

  test('example sentences', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphin',
        es_exampleSentence: 'el delfín nada en el océano.',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toEqual([
      {
        sn: [
          {
            gl: {},
            xs: [
              {
                es: 'el delfín nada en el océano.',
              },
            ],
          },
        ],
        lx: 'dolphin',
      },
    ]);
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

    expect(entries).toEqual([
      {
        sn: [
          {
            gl: {},
            sd: ['the sea!'],
            sdn: ['5.15', '1'],
            xs: [{}],
          },
        ],
        lx: 'dolphins',
      },
    ]);
  });

  test('dialects', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'foo',
        dialects: 'dialect one , dialect two',
      },
    ];
    const entries = csv_rows_without_header.map((row) => convertJsonRowToEntryFormat(row));

    expect(entries).toEqual([
      {
        sn: [
          {
            gl: {},
            xs: [{}],
          },
        ],
        lx: 'foo',
        di: ['dialect one', 'dialect two'],
      },
    ]);
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
        fakeTimeStamp as unknown as FirebaseFirestore.FieldValue
      )
    );

    expect(entries).toEqual([
      {
        ca: 10101010,
        di: ['Modern Parisian French'],
        ii: 'v4-10101010',
        lx: 'voiture',
        nt: 'small automobile',
        ph: 'vwatyʁ',
        sn: [
          {
            gl: {
              en: 'car',
              es: 'auto',
            },
            ps: ['n', 'v'],
            sd: ['vehicle|cars'],
            sdn: ['5.15', '5'],
            xs: [
              {
                en: 'I drive my car',
                es: 'Conduzco mi auto',
                vn: 'Je conduis ma voiture',
              },
            ],
          },
        ],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Modern Parisian French'],
        ii: 'v4-10101010',
        lx: 'arbre',
        nt: 'generic term for all kinds of trees',
        ph: 'aʁbʁ',
        scn: ['Acer rubrum'],
        sn: [
          {
            gl: {
              en: 'tree',
              es: 'árbol',
            },
            ps: ['n', 'adj'],
            sdn: ['1.4', '1.2'],
            xs: [
              {
                en: 'The tree gives us shade',
                es: 'El árbol nos da sombra',
                vn: "L'arbre nous donne de l'ombre",
              },
            ],
          },
        ],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Modern Parisian French'],
        ii: 'v4-10101010',
        lx: 'tube',
        nt: 'a cylindrical device for liquids',
        ph: 'tyb',
        pl: 'tubes',
        sn: [
          {
            gl: {
              en: 'tube',
              es: 'tubo',
            },
            ps: ['n'],
            sd: ['plumbing'],
            sdn: ['5.9'],
            xs: [
              {
                en: 'The water goes through the tubes',
                es: 'El agua pasa a través de los tubos',
                vn: "L'eau passe à travers les tubes",
              },
            ],
          },
        ],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Quebec French'],
        ii: 'v4-10101010',
        lx: 'voiture',
        nt: 'small automobile',
        ph: 'vwɑtYʁ',
        sn: [
          {
            gl: {
              en: 'car',
              es: 'auto',
            },
            ps: ['n'],
            sd: ['vehicle'],
            sdn: ['5.15'],
            xs: [
              {
                en: 'I drive my car',
                es: 'Conduzco mi auto',
                vn: 'Je conduis ma voiture',
              },
            ],
          },
        ],
        sr: ['testing sources'],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Quebec French'],
        ii: 'v4-10101010',
        lx: 'neutre',
        ph: 'nøʏ̯tʁ̥',
        sn: [
          {
            gl: {
              en: 'neutral',
              es: 'neutro',
            },
            ps: ['adj'],
            xs: [
              {
                en: 'My room is painted with a neutral color.',
                es: 'Mi habitación está pintada con un color neutro.',
                vn: "Ma chambre est peinte d'une couleur neutre.",
              },
            ],
          },
        ],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Quebec French'],
        ii: 'v4-10101010',
        lx: 'fêter',
        nt: 'to have a party',
        ph: 'fɛɪ̯te',
        sn: [
          {
            gl: {
              en: 'to celebrate',
              es: 'celebrar',
            },
            ps: ['v'],
            xs: [
              {
                en: 'We will really party tonight',
                es: 'Vamos a celebrar esta noche',
                vn: 'On va vraiment fêter à soir',
              },
            ],
          },
        ],
        sr: ['test source', 'with multiples sources, test', 'https://example.com'],
        ua: 10101010,
      },
      {
        ca: 10101010,
        di: ['Central Luganda'],
        ii: 'v4-10101010',
        in: '1SG-Fut-2SG-see-Fin.V',
        lx: 'njakulaba',
        mr: 'n-ja-ku-lab-a',
        sn: [
          {
            gl: {
              en: 'I will see you',
              es: 'Voy a verte',
            },
            ps: ['vp'],
            xs: [{}],
          },
        ],
        ua: 10101010,
      },
      {
        ca: 10101010,
        ii: 'v4-10101010',
        lx: 'vale',
        sn: [
          {
            gl: {
              en: 'bye',
              es: 'adiós',
            },
            xs: [{}],
          },
        ],
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

    expect(entries).toMatchInlineSnapshot([
      {
        sn: [
          {
            gl: {},
            xs: [
              {
                vn: 'Hello world',
              },
            ],
          },
        ],
        lx: undefined,
      },
    ]);
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
