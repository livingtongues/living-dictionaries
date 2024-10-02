import type { TablesUpdate } from '@living-dictionaries/types'
import { anon_supabase } from '../../config-supabase'
import { reset_db } from '../reset-db'
import { upsert_dialect, upsert_entry, upsert_sense } from './operations'
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

describe('entries and senses', () => {
  beforeAll(reset_db)

  describe(upsert_entry, () => {
    test('adds entry, adds sense, and deletes sense', async () => {
      const entry: TablesUpdate<'entries'> = {
        lexeme: {
          default: 'word',
        },
      }
      const { data } = await upsert_entry({ dictionary_id, entry, import_id: '1' })
      expect(data?.import_id).toEqual('1')
      const { data: entry_view } = await anon_supabase.from('entries_view').select().eq('id', data!.entry_id!).single()
      expect(entry_view!.dictionary_id).toEqual(dictionary_id)
      expect(entry_view).toMatchInlineSnapshot(`
      {
        "dictionary_id": "import_dictionary",
        "entry": {
          "created_at": "2024-03-08T00:44:04.6+00:00",
          "id": "11111111-1111-1111-1111-111111111101",
          "lexeme": {
            "default": "word",
          },
          "updated_at": "2024-03-08T00:44:04.6+00:00",
        },
        "id": "11111111-1111-1111-1111-111111111101",
        "senses": null,
      }
    `)
      const { data: sense_save } = await upsert_sense({ dictionary_id, entry_id: data!.entry_id!, sense: {
        glosses: { en: 'hello' },
      }, import_id: '1' })
      const { data: entry_view2 } = await anon_supabase.from('entries_view').select().eq('id', data!.entry_id!).single()
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

      await upsert_sense({ dictionary_id, entry_id: data!.entry_id!, sense: { deleted: timestamp }, sense_id: sense_save!.sense_id! })
      const { data: entry_view3 } = await anon_supabase.from('entries_view').select().eq('id', data!.entry_id!).single()
      expect(entry_view3?.senses).toBeNull()
    })
  })
})

describe(upsert_dialect, () => {
  beforeAll(reset_db)

  test('adds to dialects table, edits dialect', async () => {
    const name = 'Eastern'
    const { data } = await upsert_dialect({ dictionary_id, name, import_id: '1' })
    expect(data?.import_id).toEqual('1')
    const { data: dialect } = await anon_supabase.from('dialects').select('*').eq('id', data!.dialect_id!).single()
    expect(dialect!.name.default).toEqual(name)
    expect(dialect!.dictionary_id).toEqual(dictionary_id)

    const edited_name = 'Western'
    await upsert_dialect({ dictionary_id, name: edited_name, dialect_id: data!.dialect_id! })
    const { data: edited_dialect } = await anon_supabase.from('dialects').select('name').eq('id', data!.dialect_id!).single()
    expect(edited_dialect!.name.default).toEqual(edited_name)
  })
})
