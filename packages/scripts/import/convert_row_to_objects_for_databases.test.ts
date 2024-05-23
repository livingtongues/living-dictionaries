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

  test('wrong order in senses', () => {
    const csv_rows_with_senses: Record<string, any>[] = [
      {
        lexeme: '𒂸',
        es_gloss: 'sopa',
        en_gloss: 'soup',
        s2_es_gloss: 'agua',
        s3_es_gloss: 'líquido',
        s3_en_gloss: 'liquid',
        s2_en_gloss: 'water',
      },
    ]
    const entries = csv_rows_with_senses.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp, test: true }))

    expect(entries).not.toEqual(
      [
        {
          firebase_entry: {
            ca: 10101010,
            gl: {
              en: 'soup',
              es: 'sopa',
            },
            ii: 'v4-1715819006966',
            lx: '𒂸',
            ua: 10101010,
          },
          supabase_senses: [
            {
              sense: {
                glosses: {
                  new: {
                    es: 'agua',
                    en: 'water',
                  },
                },
              },
              sense_id: '11111111-1111-1111-1111-111111111100',
            },
            {
              sense: {
                glosses: {
                  new: {
                    en: 'liquid',
                    es: 'líquido',
                  },
                },
              },
              sense_id: '11111111-1111-1111-1111-111111111102',
            },
          ],
          supabase_sentences: [],
        },
      ],
    )
  })

  test('high-level conversion from csv with senses', () => {
    const dictionaryId = 'example-v4-senses'
    const file = readFileSync(path.join(__dirname, `./data/${dictionaryId}/${dictionaryId}.csv`), 'utf8')
    const rows = parseCSVFrom(file)
    const entries = rows.map(row => convert_row_to_objects_for_databases({ row, dateStamp: fakeDateStamp, timestamp: fakeTimeStamp, test: true }))

    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "sol",
            },
            "ii": "v4-1715819006966",
            "lx": "kꞌahkꞌal",
            "nt": "16/jul./2019. Bachajon",
            "ps": [
              "n",
            ],
            "ua": 10101010,
            "va": "kꞌajkꞌal",
            "xs": {
              "es": "Ya salió el sol",
              "vn": "Lokꞌix tal kꞌahkꞌal",
            },
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "fiebre",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "día",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "calor",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111105",
            },
          ],
          "supabase_sentences": [
            {
              "sense_id": "11111111-1111-1111-1111-111111111100",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Ay ta kꞌahkꞌal te chꞌin alale",
                  },
                },
                "translation": {
                  "new": {
                    "es": "El niño tiene fiebre",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111103",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Cheb kꞌahkꞌal ya x-aꞌtejotik",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Trabajaremos dos días",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111104",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111105",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Toyol kꞌahkꞌal ya kaꞌiy",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Siento mucho calor",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111106",
            },
          ],
        },
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "sol",
            },
            "ii": "v4-1715819006966",
            "lx": "kꞌaal",
            "nt": "26/dic./2020",
            "ps": [
              "n",
            ],
            "ua": 10101010,
            "va": "kꞌahkꞌal",
            "xs": {
              "es": "Que bueno, ya salió el sol",
              "vn": "Jaꞌnix lek-a lokꞌix tel kꞌaal",
            },
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "fiebre",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "día",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "calor",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111105",
            },
          ],
          "supabase_sentences": [
            {
              "sense_id": "11111111-1111-1111-1111-111111111100",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Ay bayal skꞌaal te chꞌin x-Ixchele",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Mi hijita Ixchel tiene mucha fiebre",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111103",
              "sentence": {
                "text": {
                  "new": {
                    "latin": ""Bajtꞌix kꞌaal mamtik, yorailix ichꞌ lewa"",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Ya transcurrió el día mi estimado señor, es momento de tomar un descanso",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111104",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111105",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Toyol kꞌaal ya jkaꞌiy",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Siento mucho calor",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111106",
            },
          ],
        },
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "sol",
            },
            "ii": "v4-1715819006966",
            "lx": "kꞌajkꞌal",
            "nt": "14/dic./2019",
            "ps": [
              "n",
            ],
            "ua": 10101010,
            "va": "kꞌahkꞌal",
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "día",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "calor",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "fiebre",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
          ],
          "supabase_sentences": [],
        },
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "fuego",
            },
            "ii": "v4-1715819006966",
            "lx": "kꞌajkꞌ",
            "nt": "23/sep./2023",
            "ps": [
              "n",
            ],
            "ua": 10101010,
            "va": "kꞌahkꞌ",
            "xs": {
              "es": "Ya hice el fuego",
              "vn": "Tilix kuꞌun-i kꞌajkꞌi",
            },
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "bravo",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "adj",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "fiebre",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "caliente",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "adj",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111105",
            },
          ],
          "supabase_sentences": [
            {
              "sense_id": "11111111-1111-1111-1111-111111111100",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Lom kꞌajkꞌ te mamal jkaxlane",
                  },
                },
                "translation": {
                  "new": {
                    "es": "El mestizo es muy bravo",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111103",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Tsakbil ta kꞌajkꞌ te alale",
                  },
                },
                "translation": {
                  "new": {
                    "es": "El bebé tiene mucha fiebre",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111104",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111105",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "El café está caliente, tómalo despacio",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Kꞌajkꞌ te kajpele, kꞌume xa awuchꞌ",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111106",
            },
          ],
        },
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "libro",
            },
            "ii": "v4-1715819006966",
            "lx": "jun",
            "nt": "26/sep./2023",
            "ps": [
              "n",
            ],
            "ua": 10101010,
            "xs": {
              "es": "¿Qué haces? - Estoy leyendo un libro",
              "vn": "¿Beluk apas? - Yakalon ta skꞌoponel jun",
            },
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "cuaderno",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111100",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "documento",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111103",
            },
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "papel",
                  },
                },
                "parts_of_speech": {
                  "new": [
                    "n",
                  ],
                },
              },
              "sense_id": "11111111-1111-1111-1111-111111111105",
            },
          ],
          "supabase_sentences": [
            {
              "sense_id": "11111111-1111-1111-1111-111111111100",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "La jta ta kitsel te june",
                  },
                },
                "translation": {
                  "new": {
                    "es": "Alcancé a rayar mi cuaderno",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111102",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111103",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Maꞌme xa awochꞌ te ajune",
                  },
                },
                "translation": {
                  "new": {
                    "es": "No vayas a arrugar tu documento",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111104",
            },
            {
              "sense_id": "11111111-1111-1111-1111-111111111105",
              "sentence": {
                "text": {
                  "new": {
                    "latin": "Zoe rompió el papel",
                  },
                },
                "translation": {
                  "new": {
                    "es": "La schꞌiꞌ jun te Zoe",
                  },
                },
              },
              "sentence_id": "11111111-1111-1111-1111-111111111106",
            },
          ],
        },
        {
          "firebase_entry": {
            "ca": 10101010,
            "gl": {
              "es": "abierto",
            },
            "ii": "v4-1715819006966",
            "lx": "jeꞌel",
            "nt": "08/abr./2019",
            "ps": [
              "adj",
            ],
            "ua": 10101010,
            "va": "makal",
            "xs": {
              "es": "La puerta de mi casa quedó abierta",
              "vn": "Jeꞌel jilel stiꞌ jna",
            },
          },
          "supabase_senses": [
            {
              "sense": {
                "glosses": {
                  "new": {
                    "es": "abrir",
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
                    "latin": "Jeꞌa tel tebuk i tiꞌnai ay bayal kꞌaal",
                  },
                },
                "translation": {
                  "new": {
                    "es": ""Abre un poco la puerta, hace mucho calor"",
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
})

function removeHeaderRow(rows: any[]) {
  return rows.splice(1)
}
