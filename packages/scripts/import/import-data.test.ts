/* eslint-disable require-await */
import { readFileSync } from 'node:fs'
import { admin_supabase, anon_supabase, diego_ld_user_id, postgres, test_dictionary_id } from '../config-supabase'
import { reset_local_db } from '../reset-local-db'
import { import_data as _import_data } from './import-data'
import { parseCSVFrom } from './parse-csv'
import type { Row } from './row.type'

const import_id = `v4-test`
const timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

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
  const yesterday = new Date('2024-03-08T00:44:04.600392+00:00')
  let milliseconds_to_add = 0

  return {
    millisecond_incrementing_timestamp: () => {
      milliseconds_to_add += 1
      return new Date(yesterday.getTime() + milliseconds_to_add).toISOString()
    },
  }
})

async function import_data(rows: Row[], dictionary_id = test_dictionary_id) {
  await _import_data({
    dictionary_id,
    rows,
    import_id,
    upload_operations: {
      upload_photo: async (filepath: string) => ({ storage_path: filepath, serving_url: filepath, error: null }),
      upload_audio: async (filepath: string) => ({ storage_path: filepath, error: null }),
      // upload_video: async (filepath: string) => ({ storage_path: filepath, error: null }),
    },
    live: true,
  })
  const { data } = await anon_supabase.rpc('entries_from_timestamp', {
    get_newer_than: timestamp_from_which_to_fetch_data,
    dict_id: dictionary_id,
  })
  return data
}

describe(import_data, () => {
  beforeEach(reset_local_db)

  test('two audio files does not duplicate senses', async () => {
    const entries = await import_data([{
      'lexeme': 'hi',
      'en_gloss': 'hi',
      'soundFile': '1.mp3',
      // @ts-expect-error
      'soundFile.2': '2.mp3', // this is what it will look like in the future but we are not yet supporting
      'photoFile': '1.jpg',
    }])
    const { data: entry } = await anon_supabase.rpc('entry_by_id', {
      passed_entry_id: entries[0].id,
    })
    expect(entry).toEqual(entries)
    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "audios": [
            {
              "id": "11111111-1111-1111-1111-111111100003",
              "storage_path": "1.mp3",
            },
            {
              "id": "11111111-1111-1111-1111-111111100004",
              "storage_path": "2.mp3",
            },
          ],
          "created_at": "2024-03-08T00:44:04.601+00:00",
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
              "id": "11111111-1111-1111-1111-111111100002",
              "photo_ids": [
                "11111111-1111-1111-1111-111111100005",
              ],
            },
          ],
          "tag_ids": [
            "11111111-1111-1111-1111-111111100001",
          ],
          "updated_at": "2024-03-08T00:44:04.608+00:00",
        },
      ]
    `)
  })

  test('imports simple entry', async () => {
    const entries = await import_data([{ lexeme: 'hi', en_gloss: 'hi', pluralForm: '', nounClass: '' }])
    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "2024-03-08T00:44:04.609+00:00",
          "deleted": null,
          "dialect_ids": null,
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100006",
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
              "id": "11111111-1111-1111-1111-111111100008",
            },
          ],
          "tag_ids": [
            "11111111-1111-1111-1111-111111100007",
          ],
          "updated_at": "2024-03-08T00:44:04.612+00:00",
        },
      ]
    `)
    const { data: tags } = await admin_supabase.from('tags').select()
    expect(tags).toMatchInlineSnapshot(`
      [
        {
          "created_at": "2024-03-08T00:44:04.61+00:00",
          "created_by": "be43b1dd-6c64-494d-b5da-10d70c384433",
          "deleted": null,
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100007",
          "name": "v4-test",
          "private": true,
          "updated_at": "2024-03-08T00:44:04.61+00:00",
          "updated_by": "be43b1dd-6c64-494d-b5da-10d70c384433",
        },
      ]
    `)
  })

  test('imports two entries with same dialect and tag', async () => {
    const entries = await import_data([
      { lexeme: 'hi', dialects: 'dialect 1', tags: 'archaic' },
      { lexeme: 'world', dialects: 'dialect 1', tags: 'archaic' },
    ])
    expect(entries[0].dialect_ids).toHaveLength(1)
    expect(entries[0].tag_ids).toHaveLength(2) // also have import tag
    expect(entries[0].dialect_ids).toEqual(entries[1].dialect_ids)
    expect(entries[0].tag_ids).toEqual(entries[1].tag_ids)
  })

  test('imports audio for two entries with same speaker', async () => {
    const entries = await import_data([
      { lexeme: 'hi', soundFile: '1.mp3', speakerName: 'speaker 1', speakerHometown: 'Whoville', speakerAge: '12', speakerGender: 'm' },
      { lexeme: 'world', soundFile: '2.mp3', speakerName: 'speaker 1' },
    ])
    const { data: speakers } = await anon_supabase.from('speakers').select()
    expect(speakers[0]).toMatchInlineSnapshot(`
      {
        "birthplace": "Whoville",
        "created_at": "2024-03-08T00:44:04.631+00:00",
        "decade": 12,
        "deleted": null,
        "dictionary_id": "test_dictionary_id",
        "gender": "m",
        "id": "11111111-1111-1111-1111-111111100020",
        "name": "speaker 1",
        "updated_at": "2024-03-08T00:44:04.631+00:00",
      }
    `)
    expect(entries[0].audios[0].speaker_ids[0]).toEqual(speakers[0].id)
    expect(entries[0].audios[0].speaker_ids).toEqual(entries[1].audios[0].speaker_ids)
  })

  test('imports photos', async () => {
    const entries = await import_data([
      { lexeme: 'hi', photoFile: 'hello.jpg' },
    ])
    expect(entries[0].senses[0].photo_ids).toMatchInlineSnapshot(`
      [
        "11111111-1111-1111-1111-111111100027",
      ]
    `)
  })

  test('imports complex entry', async () => {
    const entries = await import_data([{
      'lexeme': 'hi',
      'localOrthography': 'lo1',
      'localOrthography.2': 'lo2',
      'localOrthography.5': 'lo5',
      'phonetic': 'hɪ',
      'morphology': 'noun',
      'source': 'a fun, cool source | source 2 |',
      'scientificName': 'scientific name',
      'ID': 'A1',
      'notes': 'notes',
      'dialects': 'dialect 1| dialect 2',
      'tags': 'clean up| sea-diving, scuba',

      // first sense
      'es_gloss': 'hola',
      'partOfSpeech': 'n',
      'partOfSpeech.2': 'v',
      'variant': 'variant',
      'pluralForm': 'his',
      'nounClass': '12',
      'default_vernacular_exampleSentence': 'we say hi like this',
      'en_exampleSentence': 'this is the english hi translation',

      // second sense
      's2.en_gloss': 'bye',
      's2.semanticDomain': '2',
      's2.semanticDomain.2': '2.3',

      // third sense
      's3.fr_gloss': 'auch',
      's3.default_vernacular_exampleSentence': 'hi doc',
      's3.fr_exampleSentence': 'Bonjour docteur',
      's3.default_vernacular_exampleSentence.2': 'bye doc',
      's3.fr_exampleSentence.2': 'Au revoir docteur',
    }])
    expect(entries).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "2024-03-08T00:44:04.644+00:00",
          "deleted": null,
          "dialect_ids": [
            "11111111-1111-1111-1111-111111100029",
            "11111111-1111-1111-1111-111111100030",
          ],
          "dictionary_id": "test_dictionary_id",
          "id": "11111111-1111-1111-1111-111111100028",
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
              "a fun, cool source",
              "source 2",
            ],
          },
          "senses": [
            {
              "glosses": {
                "es": "hola",
              },
              "id": "11111111-1111-1111-1111-111111100034",
              "noun_class": "12",
              "parts_of_speech": [
                "n",
                "v",
              ],
              "plural_form": {
                "default": "his",
              },
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100035",
              ],
              "variant": {
                "default": "variant",
              },
            },
            {
              "glosses": {
                "en": "bye",
              },
              "id": "11111111-1111-1111-1111-111111100036",
              "semantic_domains": [
                "2",
                "2.3",
              ],
            },
            {
              "glosses": {
                "fr": "auch",
              },
              "id": "11111111-1111-1111-1111-111111100037",
              "sentence_ids": [
                "11111111-1111-1111-1111-111111100038",
                "11111111-1111-1111-1111-111111100039",
              ],
            },
          ],
          "tag_ids": [
            "11111111-1111-1111-1111-111111100031",
            "11111111-1111-1111-1111-111111100032",
            "11111111-1111-1111-1111-111111100033",
          ],
          "updated_at": "2024-03-08T00:44:04.663+00:00",
        },
      ]
    `)
    const { data: sentences } = await anon_supabase.from('sentences').select('id, text, translation')
    expect(sentences).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111100035",
          "text": {
            "default": "we say hi like this",
          },
          "translation": {
            "en": "this is the english hi translation",
          },
        },
        {
          "id": "11111111-1111-1111-1111-111111100038",
          "text": {
            "default": "hi doc",
          },
          "translation": {
            "fr": "Bonjour docteur",
          },
        },
        {
          "id": "11111111-1111-1111-1111-111111100039",
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
    const entries = await import_data(rows, dictionary_id)
    const { data: sentences } = await anon_supabase.from('sentences').select()
    expect({ entries, sentences }).toMatchFileSnapshot('import-data.snap.json')
  })
})
