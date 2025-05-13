import { get as get_idb, set as set_idb } from 'idb-keyval'
import type { Tables } from '@living-dictionaries/types'
import type { Supabase } from '.'

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

export function get_table_cache_key(table: DataTableName | JoinTableName, dictionary_id: string) {
  const month_year = new Date().toLocaleDateString('default', { month: '2-digit', year: 'numeric' }).replace('/', '.')
  return `${table}_${dictionary_id}_${month_year}b`
}

export async function cached_data_table<Name extends DataTableName, T extends Tables<Name>>(options: CachedDataStoreOptions<Name, keyof T>) {
  let data: Record<string, T> = {}
  const order_field = 'updated_at'

  const { dictionary_id, table, supabase, log, include } = options

  const cache_key = get_table_cache_key(table, dictionary_id)
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  if (log)
    console.info({ cache_key })

  const cached_data = await get_idb<Record<string, T>>(cache_key) || {}
  const cached_length = Object.keys(cached_data).length
  if (cached_length) {
    // Determine the latest timestamp from the cached data
    timestamp_from_which_to_fetch_data = Object.values(cached_data)
      .reduce((latest, item) => {
        const itemTimestamp = item[order_field] as string
        return itemTimestamp > latest ? itemTimestamp : latest
      }, timestamp_from_which_to_fetch_data)
    if (log)
      console.info({ [`from cache: ${cache_key}`]: cached_length })
  }

  data = cached_data
  let new_data_found = false

  const select_fields = [...include, 'id', order_field]
  if (cached_length) {
    select_fields.push('deleted')
  }

  while (true) {
    const query = supabase.from(table)
      .select(select_fields.join(', '))
      .eq('dictionary_id', dictionary_id)
      .limit(1000)
      .order(order_field, { ascending: true })
      .gt(order_field, timestamp_from_which_to_fetch_data)
    if (!cached_length) {
      query.is('deleted', null)
    }

    const { data: batch, error } = await query
    if (error) {
      if (log)
        console.error(error.message)
      throw new Error(error.message)
    }
    if (batch?.length) {
      new_data_found = true

      timestamp_from_which_to_fetch_data = batch[batch.length - 1][order_field] as string

      if (log)
        console.info({ [`latest from db: ${cache_key}`]: batch.length })

      const batch_without_nulls = batch.reduce((acc, item) => {
        const item_without_nulls = Object.fromEntries(
          Object.entries(item).filter(([_, value]) => value !== null),
        ) as T
        acc[item_without_nulls.id] = item_without_nulls
        return acc
      }, {} as Record<string, T>)

      data = { ...data, ...batch_without_nulls }
      if (batch.length < 1000) {
        break
      }
    } else {
      break
    }
  }

  if (new_data_found && cached_length) {
    data = Object.fromEntries(
      Object.entries(data).filter(([_key, item]) => !item.deleted),
    )
  }

  if (new_data_found) {
    set_idb(cache_key, data)
  }

  return data
}

export async function cached_join_table<Name extends JoinTableName, T extends Tables<Name>>(options: CachedJoinStoreOptions<Name, keyof T>) {
  let data: Record<string, T> = {}
  const order_field = 'created_at'

  const { dictionary_id, table, supabase, log, id_field_1, id_field_2 } = options

  const cache_key = get_table_cache_key(table, dictionary_id)
  let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

  if (log)
    console.info({ cache_key })

  const cached_data = await get_idb<Record<string, T>>(cache_key) || {}
  const cached_length = Object.keys(cached_data).length
  if (cached_length) {
    // Determine the latest timestamp from the cached data
    timestamp_from_which_to_fetch_data = Object.values(cached_data)
      .reduce((latest, item) => {
        const itemTimestamp = item[order_field] as string
        return itemTimestamp > latest ? itemTimestamp : latest
      }, timestamp_from_which_to_fetch_data)
    if (log)
      console.info({ [`from cache: ${cache_key}`]: cached_length })
  }

  data = cached_data
  let new_data_found = false

  const select_fields = [order_field, id_field_1, id_field_2]

  while (true) {
    const query = supabase.from(table)
      .select(select_fields.join(', '))
      .eq('dictionary_id', dictionary_id)
      .limit(1000)
      .order(order_field, { ascending: true })
      .gt(order_field, timestamp_from_which_to_fetch_data)
    if (!cached_length) {
      query.is('deleted', null)
    }

    const { data: batch, error } = await query
    if (error) {
      if (log)
        console.error(error.message)
      throw new Error(error.message)
    }
    if (batch?.length) {
      new_data_found = true

      timestamp_from_which_to_fetch_data = batch[batch.length - 1][order_field] as string

      if (log)
        console.info({ [`latest from db: ${cache_key}`]: batch.length })

      const batch_object = batch.reduce((acc, item) => {
        const combined_id = `${(item as T)[id_field_1]}_${(item as T)[id_field_2]}`
        acc[combined_id] = item as T
        return acc
      }, {} as Record<string, T>)
      data = { ...data, ...batch_object }
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
    throw new Error(error.message)
  }
  if (deleted_items?.length) {
    new_data_found = true

    deleted_items.forEach((item) => {
      const combined_id = `${(item as T)[id_field_1]}_${(item as T)[id_field_2]}`
      delete data[combined_id]
    })
  }

  if (new_data_found) {
    set_idb(cache_key, data)
  }

  return data
}
