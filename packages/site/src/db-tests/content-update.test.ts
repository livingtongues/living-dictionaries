import { admin_supabase, anon_supabase, uuid_template } from './clients'
import type { ContentUpdateRequestBody, ContentUpdateResponseBody } from '$api/db/content-update/+server'
import { post_request } from '$lib/helpers/get-post-requests'
import { first_entry_id, seeded_dictionary_id, seeded_user_id_1, seeded_user_id_2 } from '$lib/mocks/seed/tables'
import { reset_db } from '$lib/mocks/seed/write-seed-and-reset-db'

const content_update_endpoint = 'http://localhost:3041/api/db/content-update'

beforeAll(async () => {
  await reset_db()
})

let current_uuid_index = 0
function incremental_consistent_uuid() {
  return uuid_template.slice(0, -2) + (current_uuid_index++).toString().padStart(2, '0')
}

const first_entry_first_sense_id = incremental_consistent_uuid()
const first_entry_second_sense_id = incremental_consistent_uuid()
const first_entry_third_sense_id = incremental_consistent_uuid()

describe('sense operations', () => {
  test('add sense with noun class to first entry', async () => {
    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: incremental_consistent_uuid(),
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      entry_id: first_entry_id,
      sense_id: first_entry_first_sense_id,
      table: 'senses',
      change: {
        sense: {
          noun_class: {
            new: '2',
          },
        },
      },
      timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
    })
    expect(error?.message).toBeFalsy()
    const { data } = await anon_supabase.from('entries_view').select()
    expect(data).toMatchInlineSnapshot(`
      [
        {
          "id": "entry1",
          "senses": [
            {
              "id": "11111111-1111-1111-1111-111111111100",
              "noun_class": "2",
            },
          ],
        },
      ]
    `)
  })

  describe('different user add parts of speech to first sense in first entry', () => {
    test('noun class remains (upsert)', async () => {
      const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
        id: incremental_consistent_uuid(),
        auth_token: null,
        user_id_from_local: seeded_user_id_2,
        dictionary_id: seeded_dictionary_id,
        entry_id: first_entry_id,
        sense_id: first_entry_first_sense_id,
        table: 'senses',
        change: {
          sense: {
            parts_of_speech: {
              new: ['n', 'v'],
            },
          },
        },
        timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
      })
      expect(error?.message).toBeFalsy()
      const { data } = await anon_supabase.from('entries_view').select()
      expect(data).toMatchInlineSnapshot(`
      [
        {
          "id": "entry1",
          "senses": [
            {
              "id": "11111111-1111-1111-1111-111111111100",
              "noun_class": "2",
              "parts_of_speech": [
                "n",
                "v",
              ],
            },
          ],
        },
      ]
    `)
    })

    test('updated_by is set to the second user but created_by is left alone', async () => {
      const { data } = await admin_supabase.from('senses').select().eq('id', first_entry_first_sense_id).single()
      expect(data.created_by).toEqual(seeded_user_id_1)
      expect(data.updated_by).toEqual(seeded_user_id_2)
    })
  })

  test('adds glosses field to second sense in first entry', async () => {
    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: incremental_consistent_uuid(),
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      entry_id: first_entry_id,
      sense_id: first_entry_second_sense_id,
      table: 'senses',
      change: {
        sense: {
          glosses: {
            new: {
              en: 'Hi',
              es: 'Hola',
            },
          },
        },
      },
      timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
    })

    expect(error?.message).toBeFalsy()
    const { data } = await anon_supabase.from('entries_view').select()
    expect(data).toMatchInlineSnapshot(`
      [
        {
          "id": "entry1",
          "senses": [
            {
              "id": "11111111-1111-1111-1111-111111111100",
              "noun_class": "2",
              "parts_of_speech": [
                "n",
                "v",
              ],
            },
            {
              "glosses": {
                "en": "Hi",
                "es": "Hola",
              },
              "id": "11111111-1111-1111-1111-111111111101",
            },
          ],
        },
      ]
    `)
  })

  test('add a third sense to first entry with a glosses field', async () => {
    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: incremental_consistent_uuid(),
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      entry_id: first_entry_id,
      sense_id: first_entry_third_sense_id,
      table: 'senses',
      change: {
        sense: {
          semantic_domains: {
            new: ['1', '2'],
          },
        },
      },
      timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
    })
    expect(error?.message).toBeFalsy()
    const { data } = await anon_supabase.from('entries_view').select()
    expect(data).toMatchInlineSnapshot(`
      [
        {
          "id": "entry1",
          "senses": [
            {
              "id": "11111111-1111-1111-1111-111111111100",
              "noun_class": "2",
              "parts_of_speech": [
                "n",
                "v",
              ],
            },
            {
              "glosses": {
                "en": "Hi",
                "es": "Hola",
              },
              "id": "11111111-1111-1111-1111-111111111101",
            },
            {
              "id": "11111111-1111-1111-1111-111111111102",
              "semantic_domains": [
                "1",
                "2",
              ],
            },
          ],
        },
      ]
    `)
  })

  test('delete the third sense from the first entry', async () => {
    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: incremental_consistent_uuid(),
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      entry_id: first_entry_id,
      sense_id: first_entry_third_sense_id,
      table: 'senses',
      change: {
        sense: {
          deleted: true,
        },
      },
      timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
    })
    expect(error?.message).toBeFalsy()
    const { data } = await anon_supabase.from('entries_view').select()
    expect(data).toMatchInlineSnapshot(`
      [
        {
          "id": "entry1",
          "senses": [
            {
              "id": "11111111-1111-1111-1111-111111111100",
              "noun_class": "2",
              "parts_of_speech": [
                "n",
                "v",
              ],
            },
            {
              "glosses": {
                "en": "Hi",
                "es": "Hola",
              },
              "id": "11111111-1111-1111-1111-111111111101",
            },
          ],
        },
      ]
    `)
  })
})

describe('sense sentence operations', () => {
  const first_sentence_id = incremental_consistent_uuid()

  describe('add sentence to sense', () => {
    const change_id = incremental_consistent_uuid()

    test('post to endpoint', async () => {
      const { data, error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
        id: change_id,
        auth_token: null,
        user_id_from_local: seeded_user_id_1,
        dictionary_id: seeded_dictionary_id,
        entry_id: first_entry_id,
        sentence_id: first_sentence_id,
        sense_id: first_entry_first_sense_id,
        table: 'sentences',
        change: {
          sentence: {
            text: {
              new: {
                lo1: 'abcd efgh ijkl',
              },
            },
          },
        },
        timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
      })

      expect(error?.message).toBeFalsy()
      expect(data).toMatchInlineSnapshot(`
        {
          "audio_id": null,
          "change": {
            "sentence": {
              "text": {
                "new": {
                  "lo1": "abcd efgh ijkl",
                },
              },
            },
          },
          "dictionary_id": "dictionary1",
          "entry_id": "entry1",
          "id": "11111111-1111-1111-1111-111111111104",
          "import_id": null,
          "photo_id": null,
          "sense_id": "11111111-1111-1111-1111-111111111100",
          "sentence_id": "11111111-1111-1111-1111-111111111103",
          "speaker_id": null,
          "table": "sentences",
          "text_id": null,
          "timestamp": "2024-03-08T00:44:04.6+00:00",
          "user_id": "12345678-abcd-efab-cdef-123456789012",
          "video_id": null,
        }
      `)
    })

    test('change is in content_updates', async () => {
      const { data, error } = await admin_supabase.from('content_updates').select().eq('id', change_id)
      expect(error?.message).toBeFalsy()
      expect(data).toMatchInlineSnapshot(`
        [
          {
            "audio_id": null,
            "change": {
              "sentence": {
                "text": {
                  "new": {
                    "lo1": "abcd efgh ijkl",
                  },
                },
              },
            },
            "dictionary_id": "dictionary1",
            "entry_id": "entry1",
            "id": "11111111-1111-1111-1111-111111111104",
            "import_id": null,
            "photo_id": null,
            "sense_id": "11111111-1111-1111-1111-111111111100",
            "sentence_id": "11111111-1111-1111-1111-111111111103",
            "speaker_id": null,
            "table": "sentences",
            "text_id": null,
            "timestamp": "2024-03-08T00:44:04.6+00:00",
            "user_id": "12345678-abcd-efab-cdef-123456789012",
            "video_id": null,
          },
        ]
      `)
    })

    test('new sentence in correct sense in view', async () => {
      const { data, error } = await anon_supabase.from('entries_view').select()
      expect(error?.message).toBeFalsy()
      expect(data[0].senses[0].sentences).toMatchInlineSnapshot(`
        [
          {
            "id": "11111111-1111-1111-1111-111111111103",
            "text": {
              "lo1": "abcd efgh ijkl",
            },
          },
        ]
      `)
      expect(data).toMatchInlineSnapshot(`
        [
          {
            "id": "entry1",
            "senses": [
              {
                "id": "11111111-1111-1111-1111-111111111100",
                "noun_class": "2",
                "parts_of_speech": [
                  "n",
                  "v",
                ],
                "sentences": [
                  {
                    "id": "11111111-1111-1111-1111-111111111103",
                    "text": {
                      "lo1": "abcd efgh ijkl",
                    },
                  },
                ],
              },
              {
                "glosses": {
                  "en": "Hi",
                  "es": "Hola",
                },
                "id": "11111111-1111-1111-1111-111111111101",
              },
            ],
          },
        ]
      `)
    })
  })

  describe('add translation to sentence', () => {
    const change_id = incremental_consistent_uuid()

    test('post to endpoint', async () => {
      const { data, error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
        id: change_id,
        auth_token: null,
        user_id_from_local: seeded_user_id_1,
        dictionary_id: seeded_dictionary_id,
        entry_id: first_entry_id,
        sentence_id: first_sentence_id,
        sense_id: first_entry_first_sense_id,
        table: 'sentences',
        change: {
          sentence: {
            translation: {
              new: {
                en: 'I am hungry',
              },
            },
          },
        },
        timestamp: new Date('2024-03-09T00:44:04.600392+00:00').toISOString(),
      })

      expect(error?.message).toBeFalsy()
      expect(data).toMatchInlineSnapshot(`
        {
          "audio_id": null,
          "change": {
            "sentence": {
              "translation": {
                "new": {
                  "en": "I am hungry",
                },
              },
            },
          },
          "dictionary_id": "dictionary1",
          "entry_id": "entry1",
          "id": "11111111-1111-1111-1111-111111111105",
          "import_id": null,
          "photo_id": null,
          "sense_id": "11111111-1111-1111-1111-111111111100",
          "sentence_id": "11111111-1111-1111-1111-111111111103",
          "speaker_id": null,
          "table": "sentences",
          "text_id": null,
          "timestamp": "2024-03-09T00:44:04.6+00:00",
          "user_id": "12345678-abcd-efab-cdef-123456789012",
          "video_id": null,
        }
      `)
    })

    test('change is in content_updates', async () => {
      const { data, error } = await admin_supabase.from('content_updates').select().eq('sentence_id', first_sentence_id)
      expect(error?.message).toBeFalsy()
      expect(data).toHaveLength(2)
    })

    test('sentence in view now has a translation', async () => {
      const { data, error } = await anon_supabase.from('entries_view').select()
      expect(error?.message).toBeFalsy()
      expect(data[0].senses[0].sentences).toMatchInlineSnapshot(`
        [
          {
            "id": "11111111-1111-1111-1111-111111111103",
            "text": {
              "lo1": "abcd efgh ijkl",
            },
            "translation": {
              "en": "I am hungry",
            },
          },
        ]
      `)
    })
  })

  test('update sentence text updates just the text and leaves translation alone', async () => {
    const change_id = incremental_consistent_uuid()
    await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: change_id,
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      sentence_id: first_sentence_id,
      sense_id: first_entry_first_sense_id,
      table: 'sentences',
      change: {
        sentence: {
          text: {
            new: {
              lo1: 'abcd efgh',
            },
            old: {
              lo1: 'abcd efgh ijkl',
            },
          },
        },
      },
      timestamp: new Date('2024-03-09T00:44:04.600392+00:00').toISOString(),
    })

    const { data: { senses }, error } = await anon_supabase.from('entries_view').select().eq('id', first_entry_id).single()
    expect(error?.message).toBeFalsy()
    expect(senses[0].sentences).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111111103",
          "text": {
            "lo1": "abcd efgh",
          },
          "translation": {
            "en": "I am hungry",
          },
        },
      ]
    `)
  })

  test('add another translation to the same sentence', async () => {
    const { data: { senses: old_senses } } = await anon_supabase.from('entries_view').select().eq('id', first_entry_id).single()
    const change_id = incremental_consistent_uuid()
    const { data, error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: change_id,
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      sentence_id: first_sentence_id,
      sense_id: first_entry_first_sense_id,
      table: 'sentences',
      change: {
        sentence: {
          translation: {
            new: {
              ...old_senses[0].sentences[0].translation,
              es: 'Estoy hambriento',
            },
          },
        },
      },
      timestamp: new Date('2024-03-09T00:44:04.600392+00:00').toISOString(),
    })

    expect(error?.message).toBeFalsy()
    expect(data.change).toMatchInlineSnapshot(`
      {
        "sentence": {
          "translation": {
            "new": {
              "en": "I am hungry",
              "es": "Estoy hambriento",
            },
          },
        },
      }
    `)
  })

  test('see changes in entries_view ', async () => {
    const { data: { senses } } = await anon_supabase.from('entries_view').select().eq('id', first_entry_id).single()
    expect(senses[0].sentences).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111111103",
          "text": {
            "lo1": "abcd efgh",
          },
          "translation": {
            "en": "I am hungry",
            "es": "Estoy hambriento",
          },
        },
      ]
    `)
  })

  test('remove sentence from sense', async () => {
    const { error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(content_update_endpoint, {
      id: incremental_consistent_uuid(),
      auth_token: null,
      user_id_from_local: seeded_user_id_1,
      dictionary_id: seeded_dictionary_id,
      sentence_id: first_sentence_id,
      sense_id: first_entry_first_sense_id,
      table: 'sentences',
      change: {
        sentence: {
          removed_from_sense: true,
        },
      },
      timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
    })
    expect(error?.message).toBeFalsy()

    const { data: { senses }, error: view_error } = await anon_supabase.from('entries_view').select().eq('id', first_entry_id).single()
    expect(view_error?.message).toBeFalsy()
    expect(senses[0].sentences).toBeFalsy()
    expect(senses[0]).toMatchInlineSnapshot(`
      {
        "id": "11111111-1111-1111-1111-111111111100",
        "noun_class": "2",
        "parts_of_speech": [
          "n",
          "v",
        ],
      }
    `)
  })
})

// test: add translation to pre-existing sentence without sense id
// test: add a second sense to the same sense and make sure there are two sentences in that sense
// test: attach a sentence that already is connected to a sense to another sense
