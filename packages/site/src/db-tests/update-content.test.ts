import { seeded_dictionary_id, seeded_user_id } from '$lib/mocks/seed/tables';
import { reset_db } from '$lib/mocks/seed/write-seed-and-reset-db';
import type { TablesInsert } from '$lib/supabase/generated.types';
import { admin_supabase, anon_supabase, uuid_template } from './clients';

beforeAll(async () => {
  await reset_db()
})

test('add sentence', async () => {
  const first_sentence_id = uuid_template.slice(0, -2) + 'a1'

  const change_data: TablesInsert<'content_updates'> = {
    id: uuid_template.slice(0, -2) + '07',
    user_id: seeded_user_id,
    dictionary_id: seeded_dictionary_id,
    sentence_id: first_sentence_id,
    table: 'sentences',
    change: {
      column: 'text',
      new_value: 'Hi, I am a sentence',
    },
  }

  const { data, error } = await admin_supabase.functions.invoke('update-content', { body: change_data })
  expect(error?.message).toBeFalsy()
  expect(data).toMatchInlineSnapshot(`
    {
      "change": {
        "column": "text",
        "new_value": "Hi, I am a sentence",
      },
      "dictionary_id": "dictionary1",
      "id": "11111111-1111-1111-1111-111111111107",
      "sentence_id": "11111111-1111-1111-1111-1111111111a1",
      "table": "sentences",
      "user_id": "12345678-abcd-efab-cdef-123456789012",
    }
  `);
  // 5. query the db to ensure the history has been stored and the change has been made
});

// TODO: test fails if using anon_supabase

test('send update to db', async () => {
  const { data, error } = await admin_supabase.from('content_updates').insert({
    id: uuid_template,
    dictionary_id: seeded_dictionary_id,
    table: 'senses',
    change: { a: 'test', b: 'foo' },
    user_id: seeded_user_id,
    timestamp: new Date('2024-03-08T00:44:04.600392+00:00').toISOString(),
  }).select()

  expect(error?.message).toBeFalsy()
  expect(data).toMatchInlineSnapshot(`
    [
      {
        "audio_id": null,
        "change": {
          "a": "test",
          "b": "foo",
        },
        "dictionary_id": "dictionary1",
        "entry_id": null,
        "id": "11111111-1111-1111-1111-111111111111",
        "photo_id": null,
        "sense_id": null,
        "sentence_id": null,
        "speaker_id": null,
        "table": "senses",
        "text_id": null,
        "timestamp": "2024-03-08T00:44:04.6+00:00",
        "user_id": "12345678-abcd-efab-cdef-123456789012",
        "video_id": null,
      },
    ]
  `)

  const { data: expected, error: view_error } = await anon_supabase.from('entries_view').select('senses') // .eq('id', uuid_template)
  expect(view_error?.message).toBeFalsy()
  expect(expected).toMatchInlineSnapshot(`
    [
      {
        "senses": [
          {
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001",
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
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002",
          },
        ],
      },
      {
        "senses": [
          {
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011",
            "noun_class": "animals",
          },
        ],
      },
    ]
  `);
});

// user adds new part of speech
// user adds new sense gloss
// user updates sense gloss
// user adds sentence to sense
// user updates sentence
