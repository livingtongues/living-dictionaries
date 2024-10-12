import { get as getStore } from 'svelte/store'
import { get as get_idb } from 'idb-keyval'
import type { TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import { anon_supabase } from './clients'
import { cached_data_store } from '$lib/supabase/cached-data'
import { postgres } from '$lib/mocks/seed/postgres'
import { sql_file_string } from '$lib/mocks/seed/to-sql-string'
import { seeded_dictionary_id as dictionary_id, seed_dictionaries, seeded_user_id_1, users } from '$lib/mocks/seed/tables'

const log = false

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

function incremental_consistent_uuid(index: number) {
  return '22222222-2222-2222-2222-222222222222'.slice(0, -6) + (index).toString().padStart(6, '0')
}

const refresh_view_sql = 'REFRESH MATERIALIZED VIEW materialized_entries_view'
const reset_db_sql = `
  truncate table auth.users cascade;
  ${sql_file_string('auth.users', users)}
  ${sql_file_string('dictionaries', seed_dictionaries)}
  ${refresh_view_sql}`

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

describe(cached_data_store, () => {
  beforeEach(async () => {
    cached_data = []
    await postgres.execute_query(reset_db_sql)
  })

  test('gets materialized_entries_view in batches and then gets rest from entries_view', async () => {
    const materialized_count = 1500
    const recent_count = 20
    await postgres.execute_query(seed_with_entries({ offset: 0, count: materialized_count }))
    await postgres.execute_query(refresh_view_sql)
    await postgres.execute_query(seed_with_entries({ offset: materialized_count, count: recent_count }))

    const cache_key = `entries_${dictionary_id}`

    const store = cached_data_store({
      dictionary_id,
      materialized_view: 'materialized_entries_view',
      table: 'entries_view',
      supabase: anon_supabase,
      log,
    })

    expect(getStore(store.error)).toBe(null)
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

  test('first gets cached items, then gets more recent from db starting with materialized_entries_view and then from entries_view', async () => {
    const cache_key = `entries_${dictionary_id}`
    const cached_count = 30
    const materialized_count = 1200
    const recent_count = 1100

    await postgres.execute_query(seed_with_entries({ offset: 0, count: cached_count }))

    const store_to_set_up_cache = cached_data_store({
      dictionary_id,
      table: 'entries_view',
      supabase: anon_supabase,
      log,
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

    const store = cached_data_store({
      dictionary_id,
      materialized_view: 'materialized_entries_view',
      table: 'entries_view',
      supabase: anon_supabase,
      log,
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

  test('logs errors properly', async () => {
    const store = cached_data_store({
      dictionary_id,
      // @ts-expect-error
      table: 'not_real',
      supabase: anon_supabase,
      log,
    })

    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    expect(getStore(store.error)).toEqual(`relation "public.not_real" does not exist`)
  })

  test('updates an item already cached if changes are made to it', async () => {
    const cached_count = 3
    const recent_count = 3
    await postgres.execute_query(seed_with_entries({ offset: 0, count: cached_count }))

    const store = cached_data_store({
      dictionary_id,
      table: 'entries_view',
      supabase: anon_supabase,
      log,
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

    const id_to_update = incremental_consistent_uuid(1)
    const phonetic = '[fu]'
    const updated_entry: TablesUpdate<'entries'> = {
      id: id_to_update,
      phonetic,
      updated_at: new Date(startTimestamp + 10000 * 1000).toISOString(),
    }
    await postgres.execute_query(sql_file_string('entries', [updated_entry], 'UPDATE'))
    await store.refresh()
    const $store = getStore(store)
    const total_entries = cached_count + recent_count
    expect($store).toHaveLength(total_entries)
    const updated_index = $store.findIndex(entry => entry.id === id_to_update)
    expect(updated_index).toEqual(total_entries - 1)
    expect($store[updated_index].main.phonetic).toEqual(phonetic)
  })

  test('does not load down deleted items if there is nothing cached yet', async () => {
    const initial_count = 2
    await postgres.execute_query(seed_with_entries({ offset: 0, count: initial_count }))
    const id_to_update = incremental_consistent_uuid(1)
    const timestamp = new Date(startTimestamp + 10000 * 1000).toISOString()
    const updated_entry: TablesUpdate<'entries'> = {
      id: id_to_update,
      updated_at: timestamp,
      deleted: timestamp,
    }
    await postgres.execute_query(sql_file_string('entries', [updated_entry], 'UPDATE'))
    const store = cached_data_store({
      dictionary_id,
      table: 'entries_view',
      supabase: anon_supabase,
      log,
    })
    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    expect(getStore(store)).toHaveLength(initial_count - 1)
  })

  test('removes deleted items from the cache when they are deleted at a later date', async () => {
    const initial_count = 3
    await postgres.execute_query(seed_with_entries({ offset: 0, count: initial_count }))

    const store = cached_data_store({
      dictionary_id,
      table: 'entries_view',
      supabase: anon_supabase,
      log,
    })
    await new Promise((r) => {
      const unsub = store.loading.subscribe((loading) => {
        if (!loading) {
          r('loaded')
          unsub()
        }
      })
    })
    expect(getStore(store)).toHaveLength(initial_count)

    const id_to_update = incremental_consistent_uuid(1)
    const timestamp = new Date(startTimestamp + 10000 * 1000).toISOString()
    const updated_entry: TablesUpdate<'entries'> = {
      id: id_to_update,
      updated_at: timestamp,
      deleted: timestamp,
    }
    await postgres.execute_query(sql_file_string('entries', [updated_entry], 'UPDATE'))
    await store.refresh()

    expect(getStore(store)).toHaveLength(initial_count - 1)
  })
})

// const { data: materialized_entries } = await anon_supabase.from('materialized_entries_view')
//   .select()
//   .limit(1000)
//   .order('updated_at', { ascending: true })
//   .gt('updated_at', '1971-01-01T00:00:00Z')
// expect(materialized_entries).toMatchFileSnapshot('materialized_entries.snaps.json')
