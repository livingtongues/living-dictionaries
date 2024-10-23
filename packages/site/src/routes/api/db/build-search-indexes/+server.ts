import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { error, json } from '@sveltejs/kit'
import { persistToFile } from '@orama/plugin-data-persistence/server'
import type { EntryView } from '@living-dictionaries/types'
import { create, insertMultiple } from '@orama/orama'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { dev } from '$app/environment'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { augment_entry_for_search } from '$lib/search/augment-entry-for-search'
import { entries_index_schema } from '$lib/search/orama.worker'
// import { persist } from '@orama/plugin-data-persistence'

// Open to build: http://localhost:3041/api/db/build-search-indexes

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const order_field = 'updated_at'

export const GET: RequestHandler = async () => {
  if (!dev)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, { message: 'Not allowed' })

  try {
    const admin_supabase = getAdminSupabaseClient()
    const { data: dictionary_ids } = await admin_supabase.from('dictionaries').select('id')

    for (const { id: dictionary_id } of dictionary_ids) {
      const entries: EntryView[] = []
      let timestamp_from_which_to_fetch_data = '1971-01-01T00:00:00Z'

      while (true) {
        if (entries.length)
          timestamp_from_which_to_fetch_data = entries[entries.length - 1][order_field] as string

        const { data: batch, error: batch_error } = await admin_supabase
          .from('materialized_entries_view')
          .select()
          .eq('dictionary_id', dictionary_id)
          .is('deleted', null)
          .limit(1000)
          .order(order_field, { ascending: true })
          .gt(order_field, timestamp_from_which_to_fetch_data)

        if (batch_error)
          console.info({ batch_error })
        if (batch?.length) {
          entries.push(...batch)
          if (batch.length < 1000) {
            break
          }
        } else {
          break
        }
      }

      if (entries.length <= 1000)
        continue

      const search_index = await create_index(entries, dictionary_id)
      const folder = '../../../../../static/search-indexes'
      const filename = `${dictionary_id}.json`
      const filepath = path.join(__dirname, folder, filename)
      const filePath = await persistToFile(search_index, 'json', filepath)
      console.info({ filePath })
    }

    return json({ result: 'success' })
  } catch (err) {
    console.error(`Error with build: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with build: ${err.message}`)
  }
}

async function create_index(entries: EntryView[], dictionary_id: string) {
  console.info({ [dictionary_id]: entries.length })
  console.time(dictionary_id)
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  const new_index = await create({ schema: entries_index_schema })
  await insertMultiple(new_index, entries_augmented_for_search)
  console.timeEnd(dictionary_id)
  return new_index
}
