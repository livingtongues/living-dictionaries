import { get, writable } from 'svelte/store'
import { del as del_idb, get as get_idb, set as set_idb } from 'idb-keyval'
import type { Tables, TablesInsert, TablesUpdate } from '@living-dictionaries/types'
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

type JoinTableName = 'audio_speakers' | 'entry_tags' | 'entry_dialects' | 'sense_photos' | 'sense_videos' | 'senses_in_sentences'

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
      console.info({ cache_key })

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
    // data_coming_in = data_coming_in.map((item) => {
    //   delete item.dictionary_id
    //   delete item.created_at
    //   delete item.created_by
    //   return item
    // })
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

  async function insert(item_to_insert: InsertData) {
    data.update((items) => {
      return [...items, item_to_insert as unknown as T]
    })
    const { error } = await supabase.from(table)
      .insert(item_to_insert as any)
      .single()
    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.update((items) => {
        return items.filter(item => item.id !== item_to_insert.id)
      })
    } else {
      set_idb(cache_key, get(data))
    }
  }

  async function update(item_to_update: UpdateData) {
    let current_item: T
    let deleted_index: number
    data.update((items) => {
      if (item_to_update.deleted) {
        return items.filter((item, index) => {
          if (item.id !== item_to_update.id) {
            return true
          }
          current_item = item
          deleted_index = index
          return false
        })
      }
      return items.map((item) => {
        if (item.id === item_to_update.id) {
          current_item = item
          return {
            ...item,
            ...item_to_update,
          }
        }
        return item
      })
    })
    const { data: updated_item, error } = await supabase.from(table)
      .update(item_to_update)
      .eq('id', item_to_update.id)
      .single()
    if (error) {
      // if (log)
      console.error(error.message)
      store_error.set(error.message)
      if (item_to_update.deleted) {
        data.update((items) => {
          items.splice(deleted_index, 0, current_item)
          return items
        })
      } else {
        data.update((items) => {
          return items.map((item) => {
            if (item.id === item_to_update.id) {
              return current_item
            }
            return item
          })
        })
      }
    } else {
      data.update((items) => {
        const new_data = items.map((item) => {
          if (item.id === item_to_update.id) {
            return {
              ...item,
              ...updated_item as T,
            }
          }
          return item
        })
        set_idb(cache_key, new_data)
        return new_data
      })
    }
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

  async function insert(item_to_insert: InsertData) {
    data.update((items) => {
      return [...items, item_to_insert as unknown as T]
    })
    const { error } = await supabase.from(table)
      .insert(item_to_insert as any)
      .single()
    if (error) {
      if (log)
        console.error(error.message)
      store_error.set(error.message)
      data.update((items) => {
        return items.filter(item => !(item[id_field_1] === (item_to_insert as unknown as T)[id_field_1] && item[id_field_2] === (item_to_insert as unknown as T)[id_field_2]))
      })
    } else {
      set_idb(cache_key, get(data))
    }
  }

  async function update(item_to_update: UpdateData) {
    let current_item: T
    let deleted_index: number

    data.update((items) => {
      if (item_to_update.deleted) {
        return items.filter((item, index) => {
          if (!(item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2])) {
            return true
          }
          current_item = item
          deleted_index = index
          return false
        })
      }
      return items.map((item) => {
        if (item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2]) {
          current_item = item
          return {
            ...item,
            ...item_to_update,
          }
        }
        return item
      })
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
      if (item_to_update.deleted) {
        data.update((items) => {
          items.splice(deleted_index, 0, current_item)
          return items
        })
      } else {
        data.update((items) => {
          return items.map((item) => {
            if (item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2]) {
              return current_item
            }
            return item
          })
        })
      }
    } else {
      data.update((items) => {
        const new_data = items.map((item) => {
          if (item[id_field_1] === (item_to_update as unknown as T)[id_field_1] && item[id_field_2] === (item_to_update as unknown as T)[id_field_2]) {
            return {
              ...item,
              ...updated_item as T,
            }
          }
          return item
        })
        set_idb(cache_key, new_data)
        return new_data
      })
    }
  }

  return { subscribe: data.subscribe, error: store_error, loading, refresh: () => get_data_from_cache_then_db(true), updated_item, reset, insert, update }
}
