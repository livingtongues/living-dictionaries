import { anon_supabase, test_dictionary_id as dictionary_id } from '../config-supabase'
import { reset_local_db } from '../reset-local-db'
import { import_data } from './import-data'

const import_id = `v4-test`

vi.mock('node:crypto', () => {
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0

  function incremental_consistent_uuid() {
    return uuid_template.slice(0, -5) + (current_uuid_index++).toString().padStart(5, '0')
  }

  return {
    randomUUID: incremental_consistent_uuid,
  }
})

vi.mock('./incrementing-timestamp', () => {
  return {
    millisecond_incrementing_timestamp: () => new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
  }
})

describe(import_data, () => {
  beforeEach(reset_local_db)

  test('imports simple entry', async () => {
    await import_data({ dictionary_id, rows: [{ lexeme: 'hi', en_gloss: 'hi', pluralForm: '', nounClass: '' }], import_id, live: true })
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "2024-03-08T00:44:04.6+00:00",
          "deleted": null,
          "dialect_ids": null,
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100000",
          "main": {
            "lexeme": {
              "default": "hi",
            },
          },
          "senses": [
            {
              "glosses": {
                "en": "hi",
              },
              "id": "11111111-1111-1111-1111-111111100001",
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100002",
              ],
            },
          ],
          "updated_at": "2024-03-08T00:44:04.6+00:00",
        },
      ]
    `)
  })

  test('imports complex entry', async () => {
    await import_data({ dictionary_id, rows: [{
      'lexeme': 'hi',
      'localOrthography': 'lo1',
      'localOrthography.2': 'lo2',
      'localOrthography.5': 'lo5',
      'phonetic': 'hɪ',
      'morphology': 'noun',
      'source': 'source 1|source 2 ',
      'scientificName': 'scientific name',
      'ID': 'A1',
      'notes': 'notes',
      'es_gloss': 'hola',
      'partOfSpeech': 'n,v',
      'variant': 'variant',
      'pluralForm': 'his',
      'nounClass': '12',
      'semanticDomain_custom': 'custom 1',
      's2.en_gloss': 'bye',
      's3.en_gloss': 'auch',
    }], import_id, live: true })
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "2024-03-08T00:44:04.6+00:00",
          "deleted": null,
          "dialect_ids": null,
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100003",
          "main": {
            "elicitation_id": "A1",
            "lexeme": {
              "default": "hi",
              "lo1": "lo1",
              "lo2": "lo2",
              "lo5": "lo5",
            },
            "morphology": "noun",
            "notes": {
              "default": "notes",
            },
            "phonetic": "hɪ",
            "scientific_names": [
              "scientific name",
            ],
            "sources": [
              "source 1",
              "source 2",
            ],
          },
          "senses": [
            {
              "glosses": {
                "en": "bye",
              },
              "id": "11111111-1111-1111-1111-111111100005",
            },
            {
              "glosses": {
                "en": "auch",
              },
              "id": "11111111-1111-1111-1111-111111100007",
            },
            {
              "glosses": {
                "es": "hola",
              },
              "id": "11111111-1111-1111-1111-111111100004",
              "noun_class": "12",
              "parts_of_speech": [
                "n",
                "v",
              ],
              "plural_form": {
                "default": "his",
              },
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100008",
              ],
              "variant": {
                "default": "variant",
              },
              "write_in_semantic_domains": [
                "custom 1",
              ],
            },
          ],
          "updated_at": "2024-03-08T00:44:04.6+00:00",
        },
      ]
    `)
  })

  //   test('imports from CSV', async () => {
  //     const dictionary_id = 'example-v4-senses'
  //     const add_dictionary_sql = `INSERT INTO "public"."dictionaries" ("id", "name", "created_at", "created_by", "updated_at", "updated_by") VALUES
  // ('${dictionary_id}', 'Test Dictionary', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}');`
  //     await postgres.execute_query(add_dictionary_sql)

//     const file = readFileSync(`./import/data/${dictionary_id}/${dictionary_id}.csv`, 'utf8')
//     const rows = parseCSVFrom<Row>(file)
//     rows.shift() // remove header row
//     await import_data({ dictionary_id, rows, import_id, live: true })
//     const { data: entry_view } = await anon_supabase.from('entries_view').select()
//     const { data: sentences } = await anon_supabase.from('sentences').select()
//     expect({ entry_view, sentences }).toMatchFileSnapshot('import-data.snap.json')
//   })
})
