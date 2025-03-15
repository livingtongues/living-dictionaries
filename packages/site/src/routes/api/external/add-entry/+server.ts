import { json, error as kit_error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { dev } from '$app/environment'

export interface AddEntryRequestBody {
  api_key: string
  dictionary_id: string
  lexeme: string
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as AddEntryRequestBody
  const { api_key, dictionary_id, lexeme } = body

  for (const key of ['api_key', 'dictionary_id', 'lexeme']) {
    if (!body[key]) {
      kit_error(ResponseCodes.BAD_REQUEST, `${key} is required`)
    }
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

  if (!key.can_write) {
    kit_error(ResponseCodes.FORBIDDEN, 'This API key does not have write access.')
  }

  if (!dev && key.last_write_at) {
    const last_used_at = new Date(key.last_write_at)
    const now = new Date()
    const diff_ms = now.getTime() - last_used_at.getTime()
    const diff_seconds = Math.floor(diff_ms / 1000)
    if (diff_seconds < 1) {
      kit_error(ResponseCodes.TOO_MANY_REQUESTS, 'Please wait at least a second before repeat write requests.')
    }
  }

  try {
    const entry_id = crypto.randomUUID()
    const { error: entries_error } = await admin_supabase.from('entries').insert({
      id: entry_id,
      dictionary_id,
      lexeme: { default: lexeme },
      created_by: key.created_by,
      updated_by: key.created_by,
    })
    if (entries_error) {
      console.error({ entries_error })
      throw new Error(entries_error.message)
    }

    const { error: stats_error } = await admin_supabase.from('api_keys')
      .update({
        last_write_at: new Date().toISOString(),
        use_count: key.use_count + 1,
      })
      .eq('id', api_key)

    if (stats_error) {
      console.error({ stats_error })
      throw new Error(stats_error.message)
    }

    return json({ entry_id })
  } catch (err) {
    console.error(`External API error reading entries: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error getting entries: ${err.message}`)
  }
}
