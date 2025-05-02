import { writable } from 'svelte/store'
import { del as del_idb, get as get_idb, set as set_idb } from 'idb-keyval'
import type { Tables, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Supabase } from '.'
import { browser } from '$app/environment'

interface CachedDataStoreOptions<Name, FieldName> {
  dictionary_id: string
  table: Name
  include: FieldName[]
  supabase: Supabase
  log?: boolean
}

interface CachedJoinStoreOptions<Name, FieldName> {
  dictionary_id: string
  table: Name
  id_field_1: FieldName
  id_field_2: FieldName
  supabase: Supabase
  log?: boolean
}

type DataTableName = 'entries' | 'senses' | 'audio' | 'speakers' | 'tags' | 'dialects' | 'photos' | 'videos' | 'sentences'

type JoinTableName = 'audio_speakers' | 'video_speakers' | 'entry_tags' | 'entry_dialects' | 'sense_photos' | 'sense_videos' | 'senses_in_sentences'

export function cached_data_store<Name extends DataTableName, T extends Tables<Name>, InsertData extends TablesInsert<Name>, UpdateData extends TablesUpdate<Name>>(options: CachedDataStoreOptions<Name, keyof T>) {
  const data = writable<T[]>([])
  const updated_item = writable<T>(null)
  const store_error = writable<string>(null)
  const loading = writable(true)
  const order_field = 'updated_at'

  if (!browser)
    return { subscribe: data.subscribe, error: store_error, loading, refresh: null, updated_item, reset: null }

  const { dictionary_id, table, supabase, log, include } = options

  const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
  const cache_key = `${table}_${dictionary_id}_${month_year}`
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  async function get_data_from_cache_then_db(refresh = false) {
    if (log)
      console.info({ cache_key, refresh })

    const cached_data = await get_idb<T[]>(cache_key) || []
    if (cached_data.length && log) {
      console.info({ [`from cache: ${cache_key}`]: cached_data.length })
    }

    let data_coming_in = cached_data

    while (true) {
      if (data_coming_in.length)
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string
      if (cached_data?.length) {
        include.push('deleted')
      }
      const query = supabase.from(table)
        .select([...include, 'id', order_field].join(', '))
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
        break
      }
      if (batch?.length) {
        if (log)
          console.info({ [`latest from db: ${cache_key}`]: batch.length })
        const batch_without_nulls = batch.map((item) => {
          return Object.fromEntries(
            Object.entries(item).filter(([_, value]) => value !== null),
          ) as T
        })

        if (refresh) {
          for (const item of batch_without_nulls) {
            updated_item.set(item)
          }
        }

        data_coming_in = data_coming_in.concat(batch_without_nulls)
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

  async function reset() {
    await del_idb(cache_key)
    data.set([])
    updated_item.set(null)
    store_error.set(null)
    loading.set(true)
    await get_data_from_cache_then_db()
  }

  async function insert(item_to_insert: InsertData): Promise<{ data: T | null, error: PostgrestError | null }> {
    data.update((items) => {
      return [...items, item_to_insert as unknown as T]
    })

    const { data: inserted_item, error } = await supabase.from(table)
      .insert(item_to_insert as any)
      .select()
      .single()

    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.update((items) => {
        return items.filter(item => item.id !== item_to_insert.id)
      })
      return { data: null, error }
    }

    data.update((items) => {
      const index = items.findIndex(item => item.id === item_to_insert.id)
      if (index !== -1) {
        const inserted = {
          ...items[index],
          ...inserted_item as T,
        }

        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          inserted,
        ]

        set_idb(cache_key, new_data)
        return new_data
      }
      return items
    })
    return { data: inserted_item as T, error: null }
  }

  async function update(item_to_update: UpdateData): Promise<{ data: T | null, error: PostgrestError | null }> {
    if (log)
      console.info({ item_to_update })

    let current_items: T[]

    data.update((items) => {
      current_items = items
      if (item_to_update.deleted) {
        return items.filter((item) => {
          if (item.id !== item_to_update.id) {
            return true
          }
          return false
        })
      }

      const index = items.findIndex(item => item.id === item_to_update.id)
      if (index !== -1) {
        // Create the updated item by merging the original with updates
        const updated = {
          ...items[index],
          ...item_to_update,
        }

        // Create new array: copy items before target, skip target, copy items after target
        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          updated,
        ]

        return new_data
      }

      return items
    })

    const { data: updated_item, error } = await supabase.from(table)
      .update(item_to_update)
      .eq('id', item_to_update.id)
      .select()
      .single()
    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.set(current_items)
      return { data: null, error }
    }

    data.update((items) => {
      const index = items.findIndex(item => item.id === item_to_update.id)
      if (index !== -1) { // if it was deleted, it won't be found
        const updated = {
          ...items[index],
          ...updated_item as T,
        }

        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          updated,
        ]

        set_idb(cache_key, new_data)
        return new_data
      }

      return items
    })
    return { data: updated_item as T, error: null }
  }

  return { subscribe: data.subscribe, error: store_error, loading, refresh: () => get_data_from_cache_then_db(true), updated_item, reset, insert, update }
}

export function cached_join_store<Name extends JoinTableName, T extends Tables<Name>, InsertData extends TablesInsert<Name>, UpdateData extends TablesUpdate<Name>>(options: CachedJoinStoreOptions<Name, keyof T>) {
  const data = writable<T[]>([])
  const updated_item = writable<T>(null)
  const store_error = writable<string>(null)
  const loading = writable(true)
  const order_field = 'created_at'

  if (!browser)
    return { subscribe: data.subscribe, error: store_error, loading, refresh: null, updated_item, reset: null }

  const { dictionary_id, table, supabase, log, id_field_1, id_field_2 } = options

  const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
  const cache_key = `${table}_${dictionary_id}_${month_year}`
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  async function get_data_from_cache_then_db(refresh = false) {
    if (log)
      console.info({ cache_key })

    const cached_data = await get_idb<T[]>(cache_key) || []
    if (cached_data.length && log) {
      console.info({ [`from cache: ${cache_key}`]: cached_data.length })
    }

    let data_coming_in = cached_data

    while (true) {
      if (data_coming_in.length)
        timestamp_from_which_to_fetch_data = data_coming_in[data_coming_in.length - 1][order_field] as string

      const query = supabase.from(table)
        .select([order_field, id_field_1, id_field_2].join(', '))
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
        break
      }
      if (batch?.length) {
        if (log)
          console.info({ [`latest from db: ${cache_key}`]: batch.length })
        if (refresh) {
          for (const item of batch) {
            updated_item.set(item as T)
          }
        }

        data_coming_in = data_coming_in.concat(batch as T[])
        if (batch.length < 1000) {
          break
        }
      } else {
        break
      }
    }

    const { data: deleted_items, error } = await supabase.from(table)
      .select()
      .eq('dictionary_id', dictionary_id)
      .not('deleted', 'is', null)
    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
    }
    if (deleted_items?.length) {
      data_coming_in = data_coming_in.filter(item => !deleted_items.find(deleted_item => (deleted_item as T)[id_field_1] === item[id_field_1] && (deleted_item as T)[id_field_2] === item[id_field_2]))
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

  async function insert(item_to_insert: InsertData): Promise<{ data: T | null, error: PostgrestError | null }> {
    data.update((items) => {
      return [...items, item_to_insert as unknown as T]
    })

    const { data: inserted_item, error } = await supabase.from(table)
      .insert(item_to_insert as any)
      .select()
      .single()

    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.update((items) => {
        return items.filter(item => !(item[id_field_1] === (item_to_insert as unknown as T)[id_field_1] && item[id_field_2] === (item_to_insert as unknown as T)[id_field_2]))
      })
      return { data: null, error }
    }

    data.update((items) => {
      const index = items.findIndex(item => (item[id_field_1] === (item_to_insert as unknown as T)[id_field_1] && item[id_field_2] === (item_to_insert as unknown as T)[id_field_2]))
      if (index !== -1) {
        const inserted = {
          ...items[index],
          ...inserted_item as T,
        }

        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          inserted,
        ]

        set_idb(cache_key, new_data)
        return new_data
      }
      return items
    })
    return { data: inserted_item as T, error: null }
  }

  async function update(item_to_update: UpdateData): Promise<{ data: T | null, error: PostgrestError | null }> {
    if (log)
      console.info({ item_to_update })

    let current_items: T[]

    data.update((items) => {
      current_items = items

      if (item_to_update.deleted) {
        return items.filter((item) => {
          if (!(item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2])) {
            return true
          }
          return false
        })
      }

      const index = items.findIndex(item => item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2])

      if (index !== -1) {
        const updated = {
          ...items[index],
          ...item_to_update,
        }

        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          updated,
        ]

        return new_data
      }

      return items
    })

    const { data: updated_item, error } = await supabase.from(table)
      .update(item_to_update)
      // @ts-ignore
      .eq(id_field_1, item_to_update[id_field_1])
      // @ts-ignore
      .eq(id_field_2, item_to_update[id_field_2])
      .single()
    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.set(current_items)
      return { data: null, error }
    }

    data.update((items) => {
      const index = items.findIndex(item => (item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2]))
      if (index !== -1) { // if it was deleted, it won't be found
        const updated = {
          ...items[index],
          ...updated_item as T,
        }

        const new_data = [
          ...items.slice(0, index),
          ...items.slice(index + 1),
          updated,
        ]

        set_idb(cache_key, new_data)
        return new_data
      }

      return items
    })
    return { data: updated_item as T, error: null }
  }

  return { subscribe: data.subscribe, error: store_error, loading, refresh: () => get_data_from_cache_then_db(true), updated_item, reset, insert, update }
}
