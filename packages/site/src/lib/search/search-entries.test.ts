import { create, insertMultiple, save } from '@orama/orama'
import type { DeepPartial } from 'kitbook'
import type { EntryData } from '@living-dictionaries/types'
import { search_entries } from './search-entries'
import { entries_index_schema } from './entries-schema'
import { augment_entry_for_search } from './augment-entry-for-search'
import { createMultilingualTokenizer } from './multilingual-tokenizer'

function search(entries: DeepPartial<EntryData>[], query: string) {
  const index = create({
    schema: entries_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  insertMultiple(index, entries_augmented_for_search)
  return search_entries({
    dictionary_id: 'test',
    entries_per_page: 20,
    page_index: 0,
    query_params: {
      page: 1,
      query,

    },
  }, index)
}

function get_index_json(entries: DeepPartial<EntryData>[]) {
  const index = create({
    schema: entries_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  insertMultiple(index, entries_augmented_for_search)
  return save(index)
}

describe(search_entries, () => {
  test('lexeme from start of word', async () => {
    const results = await search(
      [{ main: { lexeme: { default: 'esotmïn' } } }],
      'esot',
    )
    expect(results.hits).toHaveLength(1)
  })

  test('lexeme from middle of word', async () => {
    const results = await search(
      [{ main: { lexeme: { default: 'esotman' } } }],
      'otm',
    )
    expect(results.hits).toHaveLength(1)
  })

  test('lexeme has priority', async () => {
    const results = await search([
      { main: { lexeme: { default: 'hamburger' } }, senses: [{ glosses: { something: 'fácil' } }] },
      { main: { lexeme: { default: 'etxmatohu' } }, senses: [{ glosses: { en: 'burger' } }] },
    ], 'burger')
    expect(results.hits).toHaveLength(2)
    expect(results.hits[0].document._lexeme[0]).toEqual('hamburger')
  })

  test('diacritics in gloss do not split words', async () => {
    const results = await search([
      {
        main: { lexeme: { default: 'esotman taki' } },
        senses: [{ glosses: { pt: 'fácil', tri: 'wamekatota' } }],
      },
      {
        main: { lexeme: { default: 'etxmatohu' } },
        senses: [{ glosses: { en: 'blow (something, like a flute)' } }, { glosses: { pt: 'fumar' } }],
      },
    ], 'fácil')
    expect(results.hits).toHaveLength(1)
  })

  test('inspect tokens', () => {
    const index_json = get_index_json([
      { main: { lexeme: { default: 'esotman taki' } }, senses: [{ glosses: { pt: 'fácil', tri: 'wamekatota' } }] },
    ])
    delete index_json.internalDocumentIDStore
    expect(index_json).toMatchInlineSnapshot(`
      {
        "docs": {
          "count": 1,
          "docs": {
            "1": {
              "_dialects": [],
              "_glosses": [
                "fácil",
                "wamekatota",
              ],
              "_lexeme": [
                "esotman taki",
              ],
              "_other": [],
              "_parts_of_speech": [],
              "_semantic_domains": [],
              "_speakers": [],
              "_tags": [],
              "has_audio": false,
              "has_image": false,
              "has_noun_class": false,
              "has_part_of_speech": false,
              "has_plural_form": false,
              "has_semantic_domain": false,
              "has_sentence": false,
              "has_speaker": false,
              "has_video": false,
              "id": undefined,
            },
          },
        },
        "index": {
          "avgFieldLength": {
            "_dialects": 0,
            "_glosses": 1,
            "_lexeme": 9,
            "_other": 0,
            "_parts_of_speech": 0,
            "_semantic_domains": 0,
            "_speakers": 0,
            "_tags": 0,
          },
          "fieldLengths": {
            "_dialects": {},
            "_glosses": {
              "1": 1,
            },
            "_lexeme": {
              "1": 9,
            },
            "_other": {},
            "_parts_of_speech": {},
            "_semantic_domains": {},
            "_speakers": {},
            "_tags": {},
          },
          "frequencies": {
            "_dialects": {},
            "_glosses": {
              "1": {
                "wamekatota": 1,
              },
            },
            "_lexeme": {
              "1": {
                "aki": 0.1111111111111111,
                "an": 0.1111111111111111,
                "esotman": 0.1111111111111111,
                "ki": 0.1111111111111111,
                "man": 0.1111111111111111,
                "otman": 0.1111111111111111,
                "sotman": 0.1111111111111111,
                "taki": 0.1111111111111111,
                "tman": 0.1111111111111111,
              },
            },
            "_other": {},
            "_parts_of_speech": {},
            "_semantic_domains": {},
            "_speakers": {},
            "_tags": {},
          },
          "indexes": {
            "_dialects": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_glosses": {
              "isArray": true,
              "node": {
                "c": [
                  [
                    "f",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "f",
                      "s": "fácil",
                      "w": "fácil",
                    },
                  ],
                  [
                    "w",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "w",
                      "s": "wamekatota",
                      "w": "wamekatota",
                    },
                  ],
                ],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_lexeme": {
              "isArray": true,
              "node": {
                "c": [
                  [
                    "e",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "e",
                      "s": "esotman",
                      "w": "esotman",
                    },
                  ],
                  [
                    "s",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "s",
                      "s": "sotman",
                      "w": "sotman",
                    },
                  ],
                  [
                    "o",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "o",
                      "s": "otman",
                      "w": "otman",
                    },
                  ],
                  [
                    "t",
                    {
                      "c": [
                        [
                          "m",
                          {
                            "c": [],
                            "d": [
                              1,
                            ],
                            "e": true,
                            "k": "m",
                            "s": "man",
                            "w": "tman",
                          },
                        ],
                        [
                          "a",
                          {
                            "c": [],
                            "d": [
                              1,
                            ],
                            "e": true,
                            "k": "a",
                            "s": "aki",
                            "w": "taki",
                          },
                        ],
                      ],
                      "d": [],
                      "e": false,
                      "k": "t",
                      "s": "t",
                      "w": "t",
                    },
                  ],
                  [
                    "m",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "m",
                      "s": "man",
                      "w": "man",
                    },
                  ],
                  [
                    "a",
                    {
                      "c": [
                        [
                          "n",
                          {
                            "c": [],
                            "d": [
                              1,
                            ],
                            "e": true,
                            "k": "n",
                            "s": "n",
                            "w": "an",
                          },
                        ],
                        [
                          "k",
                          {
                            "c": [],
                            "d": [
                              1,
                            ],
                            "e": true,
                            "k": "k",
                            "s": "ki",
                            "w": "aki",
                          },
                        ],
                      ],
                      "d": [],
                      "e": false,
                      "k": "a",
                      "s": "a",
                      "w": "a",
                    },
                  ],
                  [
                    "k",
                    {
                      "c": [],
                      "d": [
                        1,
                      ],
                      "e": true,
                      "k": "k",
                      "s": "ki",
                      "w": "ki",
                    },
                  ],
                ],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_other": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_parts_of_speech": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_semantic_domains": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_speakers": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "_tags": {
              "isArray": true,
              "node": {
                "c": [],
                "d": [],
                "e": false,
                "k": "",
                "s": "",
                "w": "",
              },
              "type": "Radix",
            },
            "has_audio": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_image": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_noun_class": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_part_of_speech": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_plural_form": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_semantic_domain": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_sentence": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_speaker": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
            "has_video": {
              "isArray": false,
              "node": {
                "false": [
                  1,
                ],
                "true": [],
              },
              "type": "Bool",
            },
          },
          "searchableProperties": [
            "_lexeme",
            "_glosses",
            "_other",
            "_tags",
            "_dialects",
            "_parts_of_speech",
            "_semantic_domains",
            "_speakers",
            "has_audio",
            "has_sentence",
            "has_image",
            "has_video",
            "has_speaker",
            "has_noun_class",
            "has_plural_form",
            "has_part_of_speech",
            "has_semantic_domain",
          ],
          "searchablePropertiesWithTypes": {
            "_dialects": "string[]",
            "_glosses": "string[]",
            "_lexeme": "string[]",
            "_other": "string[]",
            "_parts_of_speech": "string[]",
            "_semantic_domains": "string[]",
            "_speakers": "string[]",
            "_tags": "string[]",
            "has_audio": "boolean",
            "has_image": "boolean",
            "has_noun_class": "boolean",
            "has_part_of_speech": "boolean",
            "has_plural_form": "boolean",
            "has_semantic_domain": "boolean",
            "has_sentence": "boolean",
            "has_speaker": "boolean",
            "has_video": "boolean",
          },
          "tokenOccurrences": {
            "_dialects": {},
            "_glosses": {
              "fácil": 1,
              "wamekatota": 1,
            },
            "_lexeme": {
              "aki": 1,
              "an": 1,
              "esotman": 1,
              "ki": 1,
              "man": 1,
              "otman": 1,
              "sotman": 1,
              "taki": 1,
              "tman": 1,
            },
            "_other": {},
            "_parts_of_speech": {},
            "_semantic_domains": {},
            "_speakers": {},
            "_tags": {},
          },
          "vectorIndexes": {},
        },
        "language": "multi",
        "sorting": {
          "enabled": true,
          "isSorted": true,
          "language": "multi",
          "sortableProperties": [
            "has_audio",
            "has_sentence",
            "has_image",
            "has_video",
            "has_speaker",
            "has_noun_class",
            "has_plural_form",
            "has_part_of_speech",
            "has_semantic_domain",
          ],
          "sortablePropertiesWithTypes": {
            "has_audio": "boolean",
            "has_image": "boolean",
            "has_noun_class": "boolean",
            "has_part_of_speech": "boolean",
            "has_plural_form": "boolean",
            "has_semantic_domain": "boolean",
            "has_sentence": "boolean",
            "has_speaker": "boolean",
            "has_video": "boolean",
          },
          "sorts": {
            "has_audio": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_image": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_noun_class": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_part_of_speech": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_plural_form": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_semantic_domain": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_sentence": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_speaker": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
            "has_video": {
              "docs": {
                "1": 0,
              },
              "orderedDocs": [
                [
                  1,
                  false,
                ],
              ],
              "type": "boolean",
            },
          },
        },
      }
    `)
  })
})
