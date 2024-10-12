import { writable } from 'svelte/store'
import type { PostgrestError } from '@supabase/supabase-js'
import { get as get_idb, set as set_idb } from 'idb-keyval'
import { browser } from '$app/environment'

export interface CachedDataStoreOptions<T, F extends keyof T> {
  dictionary_id: string
  data_type: string
  order_field: F
  get_materialized_since?: (order_field: F, greater_than_timestamp: string) => Promise<Return<T[]>>
  get_latest_since: (order_field: F, greater_than_timestamp: string) => Promise<Return<T[]>>
  remove_from_db?: (id: string) => Promise<void>
  log?: boolean
}

export type Return<T> = {
  data: T
  count?: number
  error: null
} | {
  data: null
  count?: null
  error: PostgrestError
}

interface RecordWithId { id: string }

export function create_cached_data_store<T extends RecordWithId, F extends keyof T>(options: CachedDataStoreOptions<T, F>) {
  const data = writable<T[]>([])
  const store_error = writable(null)
  const loading = writable(true)

  if (!browser)
    return { subscribe: data.subscribe, store_error, loading, delete: null, refresh: null }

  const { data_type, dictionary_id, get_materialized_since, get_latest_since, remove_from_db, order_field, log } = options

  let cache_key = ``
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  async function get_data_from_cache_then_db(refresh = false) {
    const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
    cache_key = `${data_type}_${dictionary_id}_${month_year}`

    const cached_data = await get_idb<T[]>(cache_key)
    let data_coming_in = cached_data || []
    if (data_coming_in.length && log) {
      console.info({ [`from cache: ${cache_key}`]: data_coming_in.length })
    }

    // eslint-disable-next-line no-unmodified-loop-condition
    while (get_materialized_since && !refresh) {
      if (data_coming_in.length)
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string
      const { data: batch, error } = await get_materialized_since(order_field, timestamp_from_which_to_fetch_data)
      if (error)
        return store_error.set({ error })
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
      const { data: batch, error } = await get_latest_since(order_field, timestamp_from_which_to_fetch_data)
      if (error)
        return store_error.set({ error })
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
      store_error.set({ error })
    }
  }

  return { subscribe: data.subscribe, store_error, loading, remove: delete_item, refresh: () => get_data_from_cache_then_db(true) }
}
