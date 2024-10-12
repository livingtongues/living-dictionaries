import { writable } from 'svelte/store'
import { get as get_idb, set as set_idb } from 'idb-keyval'
import type { Database, Tables } from '@living-dictionaries/types'
import type { Supabase } from './database.types'
import { browser } from '$app/environment'

export interface CachedDataStoreOptions<Name> {
  dictionary_id: string
  materialized_view?: Name
  table: Name
  supabase: Supabase
  remove_from_db?: (id: string) => Promise<void>
  log?: boolean
}

interface RecordWithId {
  id: string
  deleted?: string | null
}

export function cached_data_store<F extends keyof (Database['public']['Tables'] & Database['public']['Views']), T extends Tables<F> & RecordWithId>(options: CachedDataStoreOptions<F>) {
  const data = writable<T[]>([])
  const store_error = writable<string>(null)
  const loading = writable(true)
  const order_field = 'updated_at'

  if (!browser)
    return { subscribe: data.subscribe, error: store_error, loading, delete: null, refresh: null }

  const { dictionary_id, table, materialized_view, supabase, remove_from_db, log } = options

  let cache_key = ``
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  async function get_data_from_cache_then_db(refresh = false) {
    const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
    cache_key = `${table}_${dictionary_id}_${month_year}`

    const cached_data = await get_idb<T[]>(cache_key)
    let data_coming_in = cached_data || []
    if (data_coming_in.length && log) {
      console.info({ [`from cache: ${cache_key}`]: data_coming_in.length })
    }

    // eslint-disable-next-line no-unmodified-loop-condition
    while (materialized_view && !refresh) {
      if (data_coming_in.length)
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string
      const query = supabase.from(materialized_view)
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, timestamp_from_which_to_fetch_data)
      if (!cached_data?.length) {
        query.is('deleted', null)
      }
      const { data: batch, error } = await query
      if (error)
        return store_error.set(error.message)
      if (batch?.length) {
        if (log)
          console.info({ [`materialized from db: ${cache_key}`]: batch.length })
        data_coming_in = data_coming_in.concat(batch)
        if (batch.length < 1000) {
          break
        }
      } else {
        break
      }
    }

    while (true) {
      if (data_coming_in.length)
        // eslint-disable-next-line require-atomic-updates
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string
      const query = supabase.from(table)
        .select()
        .eq('dictionary_id', dictionary_id)
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, timestamp_from_which_to_fetch_data)
      if (!cached_data?.length) {
        query.is('deleted', null)
      }
      const { data: batch, error } = await query
      if (error) {
        if (log)
          console.error(error.message)
        store_error.set(error.message)
        loading.set(false)
        return
      }
      if (batch?.length) {
        if (log)
          console.info({ [`latest from db: ${cache_key}`]: batch.length })
        data_coming_in = data_coming_in.concat(batch)
        if (batch.length < 1000) {
          break
        }
      } else {
        break
      }
    }

    if (cached_data?.length) {
      data_coming_in = data_coming_in
        .reverse()
        .filter((value, index, self) => index === self.findIndex(v => v.id === value.id))
        .filter(value => !value.deleted)
        .reverse()
    }
    data.set(data_coming_in)
    set_idb(cache_key, data_coming_in)
    loading.set(false)
  }
  get_data_from_cache_then_db()

  function delete_item(id: string) {
    try {
      data.update((items) => {
        const items_without_deleted_item = items.filter(item => item.id !== id)
        set_idb(cache_key, items_without_deleted_item)
        return items_without_deleted_item
      })
      remove_from_db?.(id)
    } catch (error) {
      store_error.set(error.message)
    }
  }

  return { subscribe: data.subscribe, error: store_error, loading, remove: delete_item, refresh: () => get_data_from_cache_then_db(true) }
}
