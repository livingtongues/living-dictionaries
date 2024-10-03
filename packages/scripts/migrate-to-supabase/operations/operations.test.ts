import type { TablesUpdate } from '@living-dictionaries/types'
import { anon_supabase } from '../../config-supabase'
import { reset_db } from '../reset-db'
import { assign_dialect, upsert_audio, upsert_dialect, upsert_entry, upsert_photo, upsert_sense, upsert_sentence, upsert_video } from './operations'
import { dictionary_id, timestamp } from './constants'

vi.mock('node:crypto', () => {
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0

  function incremental_consistent_uuid() {
    return uuid_template.slice(0, -2) + (current_uuid_index++).toString().padStart(2, '0')
  }

  return {
    randomUUID: incremental_consistent_uuid,
  }
})

async function seed_entry_and_sense() {
  const { data } = await upsert_entry({ dictionary_id, entry: { lexeme: { default: 'hi' } } })
  const { data: sense_data } = await upsert_sense({ dictionary_id, entry_id: data.entry_id, sense: { glosses: { en: 'hello' } } })
  return { entry_id: data.entry_id, sense_id: sense_data.sense_id }
}

describe('entries and senses', () => {
  beforeAll(reset_db)

  describe(upsert_entry, () => {
    test('adds entry, adds sense, and deletes sense', async () => {
      const { data } = await upsert_entry({ dictionary_id, entry: { lexeme: { default: 'hi' } }, import_id: '1' })
      expect(data?.import_id).toEqual('1')
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view.dictionary_id).toEqual(dictionary_id)
      expect(entry_view).toMatchInlineSnapshot(`
        {
          "audios": null,
          "dialect_ids": null,
          "dictionary_id": "import_dictionary",
          "id": "11111111-1111-1111-1111-111111111101",
          "main": {
            "created_at": "2024-03-08T00:44:04.6+00:00",
            "id": "11111111-1111-1111-1111-111111111101",
            "lexeme": {
              "default": "hi",
            },
            "updated_at": "2024-03-08T00:44:04.6+00:00",
          },
          "senses": null,
        }
      `)
      const { data: sense_save } = await upsert_sense({ dictionary_id, entry_id: data.entry_id, sense: {
        glosses: { en: 'hello' },
      }, import_id: '1' })
      const { data: entry_view2 } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view2?.senses).toMatchInlineSnapshot(`
      [
        {
          "glosses": {
            "en": "hello",
          },
          "id": "11111111-1111-1111-1111-111111111103",
        },
      ]
    `)

      await upsert_sense({ dictionary_id, entry_id: data.entry_id, sense: { deleted: timestamp }, sense_id: sense_save.sense_id })
      const { data: entry_view3 } = await anon_supabase.from('entries_view').select().eq('id', data.entry_id).single()
      expect(entry_view3?.senses).toBeNull()
    })
  })
})

describe(upsert_dialect, () => {
  beforeAll(reset_db)

  test('adds to dialects table, edits dialect, and connects to entry', async () => {
    const name = 'Eastern'
    const { data } = await upsert_dialect({ dictionary_id, name, import_id: '1' })
    expect(data?.import_id).toEqual('1')
    const { data: dialect } = await anon_supabase.from('dialects').select('*').eq('id', data.dialect_id).single()
    expect(dialect.name.default).toEqual(name)
    expect(dialect.dictionary_id).toEqual(dictionary_id)

    const edited_name = 'Western'
    await upsert_dialect({ dictionary_id, name: edited_name, dialect_id: data.dialect_id })
    const { data: edited_dialect } = await anon_supabase.from('dialects').select('name').eq('id', data.dialect_id).single()
    expect(edited_dialect.name.default).toEqual(edited_name)

    const { entry_id } = await seed_entry_and_sense()
    await assign_dialect({ dictionary_id, dialect_id: data.dialect_id, entry_id })
    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.dialect_ids).toEqual([data.dialect_id])
  })
})

describe(upsert_audio, () => {
  beforeAll(reset_db)

  test('adds audio and displays properly in view', async () => {
    const { entry_id } = await seed_entry_and_sense()

    const audio: TablesUpdate<'audio'> = {
      created_at: '2019-08-27T05:06:40.796Z',
      // created_by: 'Wr77x8C4e0PI3TMqOnJnJ7VmlLF3', // TODO: get this working
      entry_id,
      id: 'use-crypto-uuid-in-real-thing_2',
      source: 'javier domingo',
      storage_path: 'audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0DyO0JQrRUVXPvVNLEyN_1566882399481.mpeg',
      updated_at: '2019-08-27T05:06:40.796Z',
      // updated_by: 'Wr77x8C4e0PI3TMqOnJnJ7VmlLF3',
    }
    await upsert_audio({ dictionary_id, entry_id, audio, import_id: '1' })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.audios[0].source).toEqual(audio.source)
    expect(entry_view.audios[0].storage_path).toEqual(audio.storage_path)
  })
})

describe(upsert_sentence, () => {
  beforeAll(reset_db)

  test('adds sentence and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    await upsert_sentence({ dictionary_id, sense_id, sentence: { text: { default: 'hello, this is my sentence' } }, import_id: '1' })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].sentences).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111111123",
          "text": {
            "default": "hello, this is my sentence",
          },
        },
      ]
    `)
  })
})

describe(upsert_photo, () => {
  beforeAll(reset_db)

  test('adds photo and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    await upsert_photo({ dictionary_id, photo: { serving_url: 'foo', source: 'Bob', storage_path: 'bee/images/baz.jpeg' }, sense_id })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].photos).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111111129",
          "serving_url": "foo",
          "source": "Bob",
        },
      ]
    `)
  })
})

describe(upsert_video, () => {
  beforeAll(reset_db)

  test('adds video and links to sense', async () => {
    const { entry_id, sense_id } = await seed_entry_and_sense()
    await upsert_video({ dictionary_id, video: { source: 'Bob', storage_path: 'baz.wbm' }, sense_id })

    const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', entry_id).single()
    expect(entry_view.senses[0].videos).toMatchInlineSnapshot(`
      [
        {
          "id": "11111111-1111-1111-1111-111111111135",
          "source": "Bob",
          "storage_path": "baz.wbm",
        },
      ]
    `)
  })
})
