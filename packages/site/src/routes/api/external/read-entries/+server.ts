import { json, error as kit_error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { dev } from '$app/environment'

export interface ReadEntriesRequestBody {
  api_key: string
  dictionary_id: string
}

export const POST: RequestHandler = async ({ request }) => {
  const { api_key, dictionary_id } = await request.json() as ReadEntriesRequestBody

  if (!api_key) {
    kit_error(ResponseCodes.BAD_REQUEST, 'api_key is required')
  }

  if (!dictionary_id) {
    kit_error(ResponseCodes.BAD_REQUEST, 'dictionary_id is required')
  }

  const admin_supabase = getAdminSupabaseClient()

  const { data: key, error } = await admin_supabase.from('api_keys')
    .select()
    .eq('id', api_key)
    .eq('dictionary_id', dictionary_id)
    .single()
  if (error) {
    console.error({ error })
    kit_error(ResponseCodes.BAD_REQUEST, 'no such api_key exists for this dictionary_id')
  }

  if (!dev && key.last_read_at) {
    const last_used_at = new Date(key.last_read_at)
    const now = new Date()
    const diff = now.getTime() - last_used_at.getTime()
    const diff_minutes = Math.floor(diff / 1000 / 60)
    if (diff_minutes < 1) {
      kit_error(ResponseCodes.TOO_MANY_REQUESTS, 'Please wait at least a minute before repeat read requests. Dictionary entries are updated every hour, and you are responsible for caching results in your app to avoid hitting this rate limit.')
    }
  }

  try {
    const { data: materialized_entries, error: materialized_entries_error } = await admin_supabase.from('materialized_entries_view')
      .select()
      .eq('dictionary_id', dictionary_id)
      .order('updated_at', { ascending: true })
    if (materialized_entries_error) {
      console.error({ materialized_entries_error })
      throw new Error(materialized_entries_error.message)
    }

    const { data: latest_entries, error: latest_entries_error } = await admin_supabase.from('entries_view')
      .select()
      .eq('dictionary_id', dictionary_id)
      .gt('updated_at', materialized_entries[materialized_entries.length - 1].updated_at)
    if (latest_entries_error) {
      console.error({ latest_entries_error })
      throw new Error(latest_entries_error.message)
    }

    const { error: stats_error } = await admin_supabase.from('api_keys')
      .update({
        last_read_at: new Date().toISOString(),
        use_count: key.use_count + 1,
      })
      .eq('id', api_key)

    if (stats_error) {
      console.error({ stats_error })
      throw new Error(stats_error.message)
    }

    const cleaned_entries = [...materialized_entries, ...latest_entries].map((entry) => {
      delete entry.dictionary_id
      Object.keys(entry).forEach(key => entry[key] === null && delete entry[key])
      return entry
    })

    return json({ entries: cleaned_entries })
  } catch (err) {
    console.error(`External API error reading entries: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error getting entries: ${err.message}`)
  }
}
