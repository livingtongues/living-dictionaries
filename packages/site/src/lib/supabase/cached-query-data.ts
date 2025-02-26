import { writable } from 'svelte/store'
import { del as del_idb, get as get_idb, set as set_idb } from 'idb-keyval'
import { mode } from '.'
import { browser, dev } from '$app/environment'

interface CachedDataStoreOptions {
  key: string
  materialized_query?: any
  live_query: any
  log?: boolean
  order_field?: string
  id_fields?: string[]
}

export function cached_query_data_store<T extends { id?: string, user_id?: string, deleted?: string }>(options: CachedDataStoreOptions) {
  const data = writable<T[]>([])
  const updated_item = writable<T>(null)
  const store_error = writable<string>(null)
  const loading = writable(true)
  const search_index_updated = writable(false)

  if (!browser)
    return { subscribe: data.subscribe, error: store_error, loading, refresh: null, updated_item, reset: null, search_index_updated }

  const { key, materialized_query, live_query, log = dev, order_field = 'updated_at', id_fields = ['id'] } = options

  const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
  const cache_key = `${key}_${mode}_${month_year}`
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  async function get_data_from_cache_then_db(refresh = false) {
    if (log)
      console.info({ cache_key })

    const cached_data = await get_idb<T[]>(cache_key) || []
    if (cached_data.length && log) {
      console.info({ [`from cache: ${cache_key}`]: cached_data.length })
    }

    let cached_or_materialized = cached_data
    // eslint-disable-next-line no-unmodified-loop-condition
    while (materialized_query && !refresh) {
      if (cached_or_materialized.length)
        timestamp_from_which_to_fetch_data = cached_or_materialized[cached_or_materialized.length - 1][order_field] as string
      const query = materialized_query
        .order(order_field, { ascending: true })
        .gt(order_field, timestamp_from_which_to_fetch_data)
      // if (!cached_data?.length) {
      //   query.is('deleted', null)
      // }
      const { data: batch, error } = await query
      if (error) {
        if (log)
          console.error(error.message)
        store_error.set(error.message)
        break
      }
      if (batch?.length) {
        if (log)
          console.info({ [`materialized from db: ${cache_key}`]: batch.length })
        cached_or_materialized = cached_or_materialized.concat(batch)
        if (batch.length < 1000) {
          break
        }
      } else {
        break
      }
    }

    let data_coming_in = cached_or_materialized

    while (true) {
      if (data_coming_in.length)
        // eslint-disable-next-line require-atomic-updates
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string

      const query = live_query
        .limit(1000)
        .order(order_field, { ascending: true })
        .gt(order_field, timestamp_from_which_to_fetch_data)
      // if (!cached_or_materialized?.length) {
      //   query.is('deleted', null)
      // }
      const { data: batch, error } = await query
      if (error) {
        if (log)
          console.error(error.message)
        store_error.set(error.message)
        loading.set(false)
        break
      }
      if (batch?.length) {
        if (log)
          console.info({ [`latest from db: ${cache_key}`]: batch.length })
        if (refresh) {
          for (const item of batch) {
            updated_item.set(item)
          }
        }

        data_coming_in = data_coming_in.concat(batch)
        if (batch.length < 1000) {
          break
        }
      } else {
        break
      }
    }

    if (cached_or_materialized?.length) {
      data_coming_in = data_coming_in
        .reverse()
        .filter((value, index, self) => index === self.findIndex((v) => {
          let id = ''
          for (const field of id_fields) {
            id += value[field]
          }
          let value_id = ''
          for (const field of id_fields) {
            value_id += v[field]
          }
          return id === value_id
        }))
        .filter(value => !value.deleted)
        .reverse()
    }
    data.set(data_coming_in)
    set_idb(cache_key, data_coming_in)
    loading.set(false)
  }
  get_data_from_cache_then_db()

  async function reset() {
    await del_idb(cache_key)
    data.set([])
    updated_item.set(null)
    store_error.set(null)
    loading.set(true)
    await get_data_from_cache_then_db()
  }

  return { subscribe: data.subscribe, error: store_error, loading, refresh: () => get_data_from_cache_then_db(true), updated_item, reset, search_index_updated }
}
