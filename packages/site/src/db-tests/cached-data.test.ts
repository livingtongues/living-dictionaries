// `pnpm -F site test:db cached-data`
import { get as getStore } from 'svelte/store'
import { get as get_idb } from 'idb-keyval'
import type { Database, TablesInsert } from '@living-dictionaries/types'
import { createClient } from '@supabase/supabase-js'
import { PASSWORD, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY, anon_supabase, incremental_consistent_uuid, reset_db_sql } from './clients'
import { cached_data_store } from '$lib/supabase/cached-data'
import { postgres } from '$lib/mocks/seed/postgres'
import { sql_file_string } from '$lib/mocks/seed/to-sql-string'

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

const startTimestamp = new Date('1980-01-01T00:00:00Z').getTime()

function wait_for_data(data_store: ReturnType<typeof cached_data_store>) {
  return new Promise((r) => {
    const unsub = data_store.loading.subscribe((loading) => {
      if (!loading) {
        r('loaded')
        unsub()
      }
    })
  })
}

const dictionary_id = incremental_consistent_uuid(211)
const USER_1_ID = incremental_consistent_uuid(42)

function seed_with_entries({ count, offset }: { count: number, offset: number }) {
  const seed_entries: TablesInsert<'entries'>[] = Array.from({ length: count }, (_, index) => {
    const offset_index = index + offset
    const timestamp = new Date(startTimestamp + offset_index * 1000).toISOString()
    return {
      id: incremental_consistent_uuid(offset_index),
      lexeme: {
        default: `${offset_index} lexeme`,
      },
      dictionary_id,
      created_by: USER_1_ID,
      updated_by: USER_1_ID,
      created_at: timestamp,
      updated_at: timestamp,
    }
  })

  return `${sql_file_string('entries', seed_entries)}`
}

describe(cached_data_store, () => {
  const supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)

  const USER_1_EMAIL = `user1-${USER_1_ID}@test.com`

  beforeAll(async () => {
    await postgres.execute_query(reset_db_sql)
    const admin_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin_supabase.auth.admin.createUser({
      // @ts-expect-error
      id: USER_1_ID,
      email: USER_1_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
  })

  beforeEach(() => {
    cached_data = []
  })

  const test_1_entry_count = 1500
  test('gets entries in batches, and caches them', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    await supabase.from('dictionaries').insert({
      id: dictionary_id,
      url: dictionary_id,
      name: 'Test Dictionary',
    })

    await postgres.execute_query(seed_with_entries({ offset: 0, count: test_1_entry_count }))

    const cache_key = `entries_${dictionary_id}`

    const store = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })

    expect(getStore(store.error)).toBe(null)
    expect(getStore(store.loading)).toBeTruthy()

    await wait_for_data(store)

    const $store = getStore(store)
    expect($store).toHaveLength(test_1_entry_count)

    const cached = get_idb(cache_key)
    expect(cached).toEqual($store)
  })

  const additional_entry_count_for_test_2 = 1100
  test('first gets cached items, then gets more recent from db starting', async () => {
    const table = 'entries'
    const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
    const cache_key = `${table}_${dictionary_id}_${month_year}`

    const cached_count = test_1_entry_count
    const recent_count = additional_entry_count_for_test_2

    const store_to_set_up_cache = cached_data_store({
      dictionary_id,
      table,
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })
    await wait_for_data(store_to_set_up_cache)

    const cached = get_idb(cache_key)
    expect(cached).toHaveLength(cached_count)

    await postgres.execute_query(seed_with_entries({ offset: cached_count, count: recent_count }))

    const store = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })

    await wait_for_data(store)

    const $store = getStore(store)
    expect($store).toHaveLength(cached_count + recent_count)

    const cached_2 = get_idb(cache_key)
    expect(cached_2).toEqual($store)
  })

  const total_entries = test_1_entry_count + additional_entry_count_for_test_2

  test('updates an item already cached if changes are made to it', async () => {
    await supabase.auth.signInWithPassword({ email: USER_1_EMAIL, password: PASSWORD })
    const entries = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme', 'phonetic'],
      supabase,
      log,
    })
    await wait_for_data(entries)

    const id_to_update = incremental_consistent_uuid(1)
    const phonetic = '[fu]'
    await entries.update({
      id: id_to_update,
      phonetic,
      updated_at: new Date(startTimestamp + 10000 * 1000).toISOString(),
    })

    const $store_before_refresh = getStore(entries)
    const updated_index_before_refresh = $store_before_refresh.findIndex(entry => entry.id === id_to_update)
    expect(updated_index_before_refresh).toEqual(total_entries - 1)

    await entries.refresh()
    const $store = getStore(entries)
    expect($store).toHaveLength(total_entries)
    const updated_index = $store.findIndex(entry => entry.id === id_to_update)
    expect($store[updated_index].phonetic).toEqual(phonetic)
    expect(updated_index).toEqual(total_entries - 1)
  })

  const totat_entries_after_1_deleted = total_entries - 1

  test('does not load down deleted items if there is nothing cached yet', async () => {
    const id_to_update = incremental_consistent_uuid(0)
    const timestamp = new Date().toISOString()
    await postgres.execute_query(sql_file_string('entries', [{
      id: id_to_update,
      updated_at: timestamp,
      deleted: timestamp,
    }], 'UPDATE'))
    const entries = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })
    await wait_for_data(entries)
    expect(getStore(entries)).toHaveLength(totat_entries_after_1_deleted)
  })

  test('removes deleted items from the cache when they are deleted at a later date in a separate session', async () => {
    const entries = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })
    await wait_for_data(entries)
    expect(getStore(entries)).toHaveLength(totat_entries_after_1_deleted)

    const id_to_update = incremental_consistent_uuid(2)
    const timestamp = new Date().toISOString()
    await postgres.execute_query(sql_file_string('entries', [{
      id: id_to_update,
      updated_at: timestamp,
      deleted: timestamp,
    }], 'UPDATE'))
    await entries.refresh()
    expect(getStore(entries)).toHaveLength(totat_entries_after_1_deleted - 1)
  })

  test('updated store emits new arrivals after store refresh', async () => {
    const entries = cached_data_store({
      dictionary_id,
      table: 'entries',
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })
    await wait_for_data(entries)

    const updated_items = []
    const unsub = entries.updated_item.subscribe((item) => {
      if (item) {
        updated_items.push(item)
        unsub()
      }
    })

    const id_to_update = incremental_consistent_uuid(1)
    const timestamp = new Date(startTimestamp + 10000 * 1000).toISOString()
    await postgres.execute_query(sql_file_string('entries', [{
      id: id_to_update,
      updated_at: timestamp,
      lexeme: { default: 'a change!' },
    }], 'UPDATE'))
    await entries.refresh()
    expect(updated_items).toHaveLength(1)
  })

  test('logs errors properly', async () => {
    const store = cached_data_store({
      dictionary_id,
      // @ts-expect-error
      table: 'not_real',
      // @ts-expect-error
      include: ['lexeme'],
      supabase: anon_supabase,
      log,
    })

    await wait_for_data(store)

    expect(getStore(store.error)).toEqual(`relation "public.not_real" does not exist`)
  })
})
