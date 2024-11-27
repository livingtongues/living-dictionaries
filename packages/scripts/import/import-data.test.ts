/* eslint-disable require-await */
import { readFileSync } from 'node:fs'
import { anon_supabase, diego_ld_user_id, postgres, test_dictionary_id } from '../config-supabase'
import { reset_local_db } from '../reset-local-db'
import { import_data as _import_data } from './import-data'
import { parseCSVFrom } from './parse-csv'
import type { Row } from './row.type'

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

async function import_data(rows: Row[], dictionary_id = test_dictionary_id) {
  return await _import_data({
    dictionary_id,
    rows,
    import_id,
    upload_operations: {
      upload_photo: async (filepath: string) => ({ storage_path: filepath, serving_url: filepath }),
      upload_audio: async (filepath: string) => ({ storage_path: filepath }),
      upload_video: async (filepath: string) => ({ storage_path: filepath }),
    },
    live: true,
  })
}

describe(import_data, () => {
  beforeEach(reset_local_db)

  test('imports simple entry', async () => {
    await import_data([{ lexeme: 'hi', en_gloss: 'hi', pluralForm: '', nounClass: '' }])
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
            },
          ],
          "updated_at": "2024-03-08T00:44:04.6+00:00",
        },
      ]
    `)
  })

  test('imports two entries with same dialect', async () => {
    await import_data([
      { lexeme: 'hi', dialects: 'dialect 1' },
      { lexeme: 'world', dialects: 'dialect 1' },
    ])
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view[0].dialect_ids).toHaveLength(1)
    expect(entry_view[0].dialect_ids).toEqual(entry_view[1].dialect_ids)
  })

  test('imports audio for two entries with same speaker', async () => {
    await import_data([
      { lexeme: 'hi', soundFile: '1.mp3', speakerName: 'speaker 1' },
      { lexeme: 'world', soundFile: '2.mp3', speakerName: 'speaker 1' },
    ])
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view[0].audios[0].speaker_ids).toHaveLength(1)
    expect(entry_view[0].audios[0].speaker_ids).toEqual(entry_view[1].audios[0].speaker_ids)
  })

  test('imports photos', async () => {
    await import_data([
      { lexeme: 'hi', photoFile: 'hello.jpg' },
    ])
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view[0].senses[0].photo_ids).toMatchInlineSnapshot(`
      [
        "11111111-1111-1111-1111-111111100016",
      ]
    `)
  })

  test('imports complex entry', async () => {
    await import_data([{
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
      'dialects': 'dialect 1, dialect 2', // TODO, is this comma separation the plan? The code handles this.
      // first sense
      'es_gloss': 'hola',
      'partOfSpeech': 'n,v', // TODO: is this comma separation the plan? The code handles this.
      'variant': 'variant',
      'pluralForm': 'his',
      'nounClass': '12',
      'semanticDomain_custom': 'custom 1', // TODO: spreadsheet allows for pipe separation here but actual code does not
      'default_vernacular_exampleSentence': 'we say hi like this',
      'en_exampleSentence': 'this is the english hi translation',
      // second sense
      's2.en_gloss': 'bye',
      's2.semanticDomain': '2',
      's2.semanticDomain.2': '2.3', // TODO: or is this number suffix the plan (cf. partOfSpeech above) - see the code for how to handle each type, but we should settle on one or the other method - code is not currently handling this column
      // third sense
      's3.fr_gloss': 'auch',
      's3.default_vernacular_exampleSentence': 'hi doc',
      's3.fr_exampleSentence': 'Bonjour docteur',
      's3.default_vernacular_exampleSentence.2': 'bye doc',
      's3.fr_exampleSentence.2': 'Au revoir docteur',
    }])
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    expect(entry_view).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "2024-03-08T00:44:04.6+00:00",
          "deleted": null,
          "dialect_ids": [
            "11111111-1111-1111-1111-111111100018",
            "11111111-1111-1111-1111-111111100019",
          ],
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100017",
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
                "es": "hola",
              },
              "id": "11111111-1111-1111-1111-111111100020",
              "noun_class": "12",
              "parts_of_speech": [
                "n",
                "v",
              ],
              "plural_form": {
                "default": "his",
              },
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100021",
              ],
              "variant": {
                "default": "variant",
              },
              "write_in_semantic_domains": [
                "custom 1",
              ],
            },
            {
              "glosses": {
                "en": "bye",
              },
              "id": "11111111-1111-1111-1111-111111100022",
              "semantic_domains": [
                "2",
                "2.3",
              ],
            },
            {
              "glosses": {
                "fr": "auch",
              },
              "id": "11111111-1111-1111-1111-111111100023",
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100024",
                "11111111-1111-1111-1111-111111100025",
              ],
            },
          ],
          "updated_at": "2024-03-08T00:44:04.6+00:00",
        },
      ]
    `)
    const { data: sentences } = await anon_supabase.from('sentences').select('id, text, translation')
    expect(sentences).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111100021",
          "text": {
            "default": "we say hi like this",
          },
          "translation": {
            "en": "this is the english hi translation",
          },
        },
        {
          "id": "11111111-1111-1111-1111-111111100024",
          "text": {
            "default": "hi doc",
          },
          "translation": {
            "fr": "Bonjour docteur",
          },
        },
        {
          "id": "11111111-1111-1111-1111-111111100025",
          "text": {
            "default": "bye doc",
          },
          "translation": null,
        },
      ]
    `)
  })

  test('imports from CSV', async () => {
    const dictionary_id = 'example-v4-senses'
    const add_dictionary_sql = `INSERT INTO "public"."dictionaries" ("id", "name", "created_at", "created_by", "updated_at", "updated_by") VALUES
  ('${dictionary_id}', 'Test Dictionary', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}');`
    await postgres.execute_query(add_dictionary_sql)

    const file = readFileSync(`./import/data/${dictionary_id}/${dictionary_id}.csv`, 'utf8')
    const rows = parseCSVFrom<Row>(file)
    rows.shift() // remove header row
    await import_data(rows, dictionary_id)
    const { data: entry_view } = await anon_supabase.from('entries_view').select()
    const { data: sentences } = await anon_supabase.from('sentences').select()
    expect({ entry_view, sentences }).toMatchFileSnapshot('import-data.snap.json')
  })
})