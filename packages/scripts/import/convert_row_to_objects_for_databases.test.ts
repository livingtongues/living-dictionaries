// Add your tests here, borrowing from what you already have
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Timestamp } from 'firebase-admin/firestore'
import { convert_row_to_objects_for_databases } from './convert_row_to_objects_for_databases.js'
import { parseCSVFrom } from './parse-csv.js'

describe('convertJsonRowToEntryFormat without senses', () => {
  const fakeTimeStamp = 10101010 as unknown as Timestamp
  const fakeDateStamp = 1715819006966

  test('glosses', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphin',
        es_gloss: 'delfín',
      },
    ]
    const entries = csv_rows_without_header.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "delfín",
            },
            "ii": "v4-1715819006966",
            "lx": "dolphin",
            "ua": 10101010,
          },
          "supabase_senses": [],
          "supabase_sentences": [],
        },
      ]
    `)
  })

  test('example sentences', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphin',
        es_exampleSentence: 'el delfín nada en el océano.',
      },
    ]
    const entries = csv_rows_without_header.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {},
            "ii": "v4-1715819006966",
            "lx": "dolphin",
            "ua": 10101010,
            "xs": {
              "es": "el delfín nada en el océano.",
            },
          },
          "supabase_senses": [],
          "supabase_sentences": [],
        },
      ]
    `)
  })

  test('semantic domains', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        lexeme: 'dolphins',
        semanticDomain: '5.15',
        semanticDomain2: '1',
        semanticDomain_custom: 'the sea!',
      },
    ]
    const entries = csv_rows_without_header.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {},
            "ii": "v4-1715819006966",
            "lx": "dolphins",
            "sd": [
              "the sea!",
            ],
            "sdn": [
              "5.15",
              "1",
            ],
            "ua": 10101010,
          },
          "supabase_senses": [],
          "supabase_sentences": [],
        },
      ]
    `)
  })

  test('high-level conversion from csv', () => {
    const dictionaryId = 'example-v4'
    const file = readFileSync(path.join(__dirname, `./data/${dictionaryId}/${dictionaryId}.csv`), 'utf8')
    const rows = parseCSVFrom(file)
    const rowsWithoutHeader = removeHeaderRow(rows)
    const entries = rowsWithoutHeader.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp }))

    expect(entries).toEqual(
      [
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Modern Parisian French',
            ],
            gl: {
              en: 'car',
              es: 'auto',
            },
            ii: 'v4-1715819006966',
            lx: 'voiture',
            nt: 'small automobile',
            ph: 'vwatyʁ',
            ps: [
              'n',
              'v',
            ],
            sd: [
              'vehicle|cars',
            ],
            sdn: [
              '5.15',
              '5',
            ],
            ua: 10101010,
            xs: {
              en: 'I drive my car',
              es: 'Conduzco mi auto',
              vn: 'Je conduis ma voiture',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Modern Parisian French',
              'Quebec French',
            ],
            gl: {
              en: 'tree',
              es: 'árbol',
            },
            ii: 'v4-1715819006966',
            lx: 'arbre',
            nt: 'generic term for all kinds of trees',
            ph: 'aʁbʁ',
            ps: [
              'n',
              'adj',
            ],
            scn: [
              'Acer rubrum',
            ],
            sdn: [
              '1.4',
              '1.2',
            ],
            ua: 10101010,
            xs: {
              en: 'The tree gives us shade',
              es: 'El árbol nos da sombra',
              vn: 'L\'arbre nous donne de l\'ombre',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Modern Parisian French',
            ],
            gl: {
              en: 'tube',
              es: 'tubo',
            },
            ii: 'v4-1715819006966',
            lx: 'tube',
            nt: 'a cylindrical device for liquids',
            ph: 'tyb',
            pl: 'tubes',
            ps: [
              'n',
            ],
            sd: [
              'plumbing',
            ],
            sdn: [
              '5.9',
            ],
            ua: 10101010,
            xs: {
              en: 'The water goes through the tubes',
              es: 'El agua pasa a través de los tubos',
              vn: 'L\'eau passe à travers les tubes',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Quebec French',
            ],
            gl: {
              en: 'car',
              es: 'auto',
            },
            ii: 'v4-1715819006966',
            lx: 'voiture',
            nt: 'small automobile',
            ph: 'vwɑtYʁ',
            ps: [
              'n',
            ],
            sd: [
              'vehicle',
            ],
            sdn: [
              '5.15',
            ],
            sr: [
              'testing sources',
            ],
            ua: 10101010,
            xs: {
              en: 'I drive my car',
              es: 'Conduzco mi auto',
              vn: 'Je conduis ma voiture',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Quebec French',
            ],
            gl: {
              en: 'neutral',
              es: 'neutro',
            },
            ii: 'v4-1715819006966',
            lx: 'neutre',
            ph: 'nøʏ̯tʁ̥',
            ps: [
              'adj',
            ],
            ua: 10101010,
            xs: {
              en: 'My room is painted with a neutral color.',
              es: 'Mi habitación está pintada con un color neutro.',
              vn: 'Ma chambre est peinte d\'une couleur neutre.',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Quebec French',
            ],
            gl: {
              en: 'to celebrate',
              es: 'celebrar',
            },
            ii: 'v4-1715819006966',
            lx: 'fêter',
            nt: 'to have a party',
            ph: 'fɛɪ̯te',
            ps: [
              'v',
            ],
            sr: [
              'test source',
              'with multiples sources, test',
              'https://example.com',
            ],
            ua: 10101010,
            xs: {
              en: 'We will really party tonight',
              es: 'Vamos a celebrar esta noche',
              vn: 'On va vraiment fêter à soir',
            },
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            di: [
              'Central Luganda',
            ],
            gl: {
              en: 'I will see you',
              es: 'Voy a verte',
            },
            ii: 'v4-1715819006966',
            in: '1SG-Fut-2SG-see-Fin.V',
            lx: 'njakulaba',
            mr: 'n-ja-ku-lab-a',
            ps: [
              'vp',
            ],
            ua: 10101010,
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
        {
          firebase_entry: {
            ca: 10101010,
            gl: {
              en: 'bye',
              es: 'adiós',
            },
            ii: 'v4-1715819006966',
            lx: 'vale',
            ua: 10101010,
          },
          supabase_senses: [],
          supabase_sentences: [],
        },
      ],
    )
  })

  test('does not duplicate vernacular', () => {
    const csv_rows_without_header: Record<string, any>[] = [
      {
        vernacular_exampleSentence: 'Hello world',
      },
    ]
    const entries = csv_rows_without_header.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {},
            "ii": "v4-1715819006966",
            "lx": undefined,
            "ua": 10101010,
            "xs": {
              "vn": "Hello world",
            },
          },
          "supabase_senses": [],
          "supabase_sentences": [],
        },
      ]
    `)
  })
})

describe('convertJsonRowToEntryFormat with senses', () => {
  const fakeTimeStamp = 10101010 as unknown as Timestamp
  const fakeDateStamp = 1715819006966

  test('multiple senses (glosses))', () => {
    const csv_rows_with_senses: Record<string, any>[] = [
      {
        lexeme: '𒄧𒂸',
        es_gloss: 'delfín',
        en_gloss: 'dolphin',
        s2_es_gloss: 'pez',
        s2_en_gloss: 'fish',
        s3_en_gloss: 'marine mammal',
        s4_en_gloss: 'mythological creature',
        s4_es_gloss: 'creatura mitológica',
        s4_fr_gloss: 'créature mythologique',

      },
    ]
    const entries = csv_rows_with_senses.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp, test: true }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "en": "dolphin",
              "es": "delfín",
            },
            "ii": "v4-1715819006966",
            "lx": "𒄧𒂸",
            "ua": 10101010,
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "en": "fish",
                    "es": "pez",
                  },
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "en": "marine mammal",
                  },
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "en": "mythological creature",
                    "es": "creatura mitológica",
                    "fr": "créature mythologique",
                  },
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
          ],
          "supabase_sentences": [],
        },
      ]
    `)
  })
  test('senses with sentences', () => {
    const csv_rows_with_sentences: Record<string, any>[] = [
      {
        lexeme: '𒄧𒂸',
        en_gloss: 'dolphin',
        s2_en_gloss: 'fish',
        s2_default_vn_ES: '𒄧𒂸 𒄧 𒄧𒂸 𒂸𒂸𒄧',
        s2_en_GES: 'The fish is swimmmimg',
        s2_es_GES: 'El pez está nadando',
      },
    ]
    const entries = csv_rows_with_sentences.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp, test: true }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "en": "dolphin",
            },
            "ii": "v4-1715819006966",
            "lx": "𒄧𒂸",
            "ua": 10101010,
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "en": "fish",
                  },
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
          ],
          "supabase_sentences": [
            {
              "sense_id": "11111111-1111-1111-1111-111111111100",
              "sentence": {
                "text": {
                  "new": {
                    "default": "𒄧𒂸 𒄧 𒄧𒂸 𒂸𒂸𒄧",
                  },
                },
                "translation": {
                  "new": {
                    "en": "The fish is swimmmimg",
                    "es": "El pez está nadando",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111102",
            },
          ],
        },
      ]
    `)
  })
  test('senses with the rest fields', () => {
    const csv_rows_with_other_fields: Record<string, any>[] = [
      {
        lexeme: 'foo',
        en_gloss: 'test',
        s2_en_gloss: 'example',
        s2_partOfSpeech: 'n',
        s2_semanticDomains: '1.1',
        s2_nounClass: 'S',
      },
    ]
    const entries = csv_rows_with_other_fields.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp, test: true }))
    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "en": "test",
            },
            "ii": "v4-1715819006966",
            "lx": "foo",
            "ua": 10101010,
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "en": "example",
                  },
                },
                "noun_class": {
                  "new": "S",
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
                "semantic_domains": {
                  "new": [
                    "1.1",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
          ],
          "supabase_sentences": [],
        },
      ]
    `)
  })
})

function removeHeaderRow(rows: any[]) {
  return rows.splice(1)
}
