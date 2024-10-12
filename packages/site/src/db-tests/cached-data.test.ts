import { get as getStore } from 'svelte/store'
import { get as get_idb, set as set_idb } from 'idb-keyval'
import type { TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import type { PostgrestError } from '@supabase/supabase-js'
import { anon_supabase } from './clients'
import { type Return, create_cached_data_store } from '$lib/supabase/cached-data'
import { postgres } from '$lib/mocks/seed/postgres'
import { sql_file_string } from '$lib/mocks/seed/to-sql-string'
import { seeded_dictionary_id as dictionary_id, seed_dictionaries, seeded_user_id_1, users } from '$lib/mocks/seed/tables'

vi.mock('$app/environment', () => {
  return {
    browser: true,
  }
})

let cached_data: any[] = []

vi.mock('idb-keyval', () => {
  return {
    set: vi.fn((key: string, value: any[]) => {
      cached_data = value
    }),
    get: vi.fn((_key: string) => {
      return cached_data?.length ? cached_data : undefined
    }),
  }
})

function mock_error(message: string): Promise<Return<any[]>> {
  return Promise.resolve({
    data: null,
    error: { message } as PostgrestError,
  })
}

function incremental_consistent_uuid(index: number) {
  return '22222222-2222-2222-2222-222222222222'.slice(0, -6) + (index).toString().padStart(6, '0')
}

const reset_db_sql = `
  truncate table auth.users cascade;
  ${sql_file_string('auth.users', users)}
  ${sql_file_string('dictionaries', seed_dictionaries)}`

const startTimestamp = new Date('1980-01-01T00:00:00Z').getTime()

function seed_with_entries({ count, offset }: { count: number, offset: number }) {
  const seed_entries: TablesInsert<'entries'>[] = Array.from({ length: count }, (_, index) => {
    const offset_index = index + offset
    const entryTimestamp = new Date(startTimestamp + offset_index * 1000).toISOString()
    return {
      id: incremental_consistent_uuid(offset_index),
      lexeme: {
        default: `${offset_index} lexeme`,
      },
      dictionary_id,
      created_by: seeded_user_id_1,
      updated_by: seeded_user_id_1,
      created_at: entryTimestamp,
      updated_at: entryTimestamp,
    }
  })

  return `${sql_file_string('entries', seed_entries)}`
}

const refresh_view_sql = 'REFRESH MATERIALIZED VIEW materialized_entries_view'

describe(create_cached_data_store, () => {
  beforeEach(async () => {
    cached_data = []
    await postgres.execute_query(reset_db_sql)
  })

  test('if nothing in the cache, gets materialized_entries_view in batches and then gets last chunk from entries_view', async () => {
    const materialized_count = 1500
    const recent_count = 20
    await postgres.execute_query(seed_with_entries({ offset: 0, count: materialized_count }))
    await postgres.execute_query(refresh_view_sql)
    await postgres.execute_query(seed_with_entries({ offset: materialized_count, count: recent_count }))

    const cache_key = `entries_${dictionary_id}`

    const store = create_cached_data_store({
      dictionary_id,
      data_type: 'entries',
      order_field: 'updated_at',
      get_materialized_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('materialized_entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      get_latest_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      log: true,
    })

    expect(getStore(store.store_error)).toBe(null)
    expect(getStore(store.loading)).toBeTruthy()

    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    const $store = getStore(store)
    expect($store).toHaveLength(materialized_count + recent_count)

    const cached = get_idb(cache_key)
    expect(cached).toEqual($store)
  })

  test('has 30 in the cache, then gets 1200 more recent starting with materialized_entries_view in batches and then gets an additional 1100 from entries_view', async () => {
    const cache_key = `entries_${dictionary_id}`
    const cached_count = 30
    const materialized_count = 1200
    const recent_count = 1100

    await postgres.execute_query(seed_with_entries({ offset: 0, count: cached_count }))

    const store_to_set_up_cache = create_cached_data_store({
      dictionary_id,
      data_type: 'entries',
      order_field: 'updated_at',
      get_latest_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      log: true,
    })
    await new Promise((r) => {
      const unsub = store_to_set_up_cache.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    const cached = get_idb(cache_key)
    expect(cached).toHaveLength(cached_count)

    await postgres.execute_query(seed_with_entries({ offset: cached_count, count: materialized_count }))
    await postgres.execute_query(refresh_view_sql)
    await postgres.execute_query(seed_with_entries({ offset: cached_count + materialized_count, count: recent_count }))

    const store = create_cached_data_store({
      dictionary_id,
      data_type: 'entries',
      order_field: 'updated_at',
      get_materialized_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('materialized_entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      get_latest_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      log: true,
    })

    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    const $store = getStore(store)
    expect($store).toHaveLength(cached_count + materialized_count + recent_count)

    const cached_2 = get_idb(cache_key)
    expect(cached_2).toEqual($store)
  })

  // test('logs error properly', async () => {
  //   mock_error('db is not available')
  // })
  test('updating an item that is already cached will cause the cached_data_store to pull down update from db and overwrite that item', async () => {
    const cached_count = 3
    const recent_count = 3
    await postgres.execute_query(seed_with_entries({ offset: 0, count: cached_count }))

    const store = create_cached_data_store({
      dictionary_id,
      data_type: 'entries',
      order_field: 'updated_at',
      get_latest_since: async (order_field: string, greater_than_timestamp: string) => await anon_supabase.from('entries_view')
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, greater_than_timestamp),
      log: true,
    })
    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })

    await postgres.execute_query(seed_with_entries({ offset: cached_count, count: recent_count }))

    const updated_entry: TablesUpdate<'entries'> = {
      id: incremental_consistent_uuid(1),
      phonetic: '[something-added]',
      updated_at: new Date(startTimestamp + 10000 * 1000).toISOString(),
    }
    await postgres.execute_query(sql_file_string('entries', [updated_entry], 'UPDATE'))
    await store.refresh()
    expect(getStore(store)).toMatchInlineSnapshot(`
      [
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:00+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000000",
          "main": {
            "lexeme": {
              "default": "0 lexeme",
            },
          },
          "senses": null,
          "updated_at": "1980-01-01T00:00:00+00:00",
        },
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:02+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000002",
          "main": {
            "lexeme": {
              "default": "2 lexeme",
            },
          },
          "senses": null,
          "updated_at": "1980-01-01T00:00:02+00:00",
        },
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:03+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000003",
          "main": {
            "lexeme": {
              "default": "3 lexeme",
            },
          },
          "senses": null,
          "updated_at": "1980-01-01T00:00:03+00:00",
        },
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:04+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000004",
          "main": {
            "lexeme": {
              "default": "4 lexeme",
            },
          },
          "senses": null,
          "updated_at": "1980-01-01T00:00:04+00:00",
        },
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:05+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000005",
          "main": {
            "lexeme": {
              "default": "5 lexeme",
            },
          },
          "senses": null,
          "updated_at": "1980-01-01T00:00:05+00:00",
        },
        {
          "audios": null,
          "created_at": "1980-01-01T00:00:01+00:00",
          "dialect_ids": null,
          "dictionary_id": "dictionary1",
          "id": "22222222-2222-2222-2222-222222000001",
          "main": {
            "lexeme": {
              "default": "1 lexeme",
            },
            "phonetic": "[something-added]",
          },
          "senses": null,
          "updated_at": "1980-01-01T02:46:40+00:00",
        },
      ]
    `)
  })
})

// const { data: materialized_entries } = await anon_supabase.from('materialized_entries_view')
//   .select()
//   .limit(1000)
//   .order('updated_at', { ascending: true })
//   .gt('updated_at', '1971-01-01T00:00:00Z')
// expect(materialized_entries).toMatchFileSnapshot('materialized_entries.snaps.json')
