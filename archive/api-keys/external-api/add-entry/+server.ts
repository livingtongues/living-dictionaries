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

const EXPECTED_FIELDS = ['api_key', 'dictionary_id', 'lexeme'] as const

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const body = await request.json() as AddEntryRequestBody

    for (const key of EXPECTED_FIELDS) {
      if (!body[key]) {
        kit_error(ResponseCodes.BAD_REQUEST, `${key} is required`)
      }
    }

    const { api_key, dictionary_id, lexeme } = body
    const validated_lexeme = validateLexeme(lexeme)

    const admin_supabase = getAdminSupabaseClient()
    const { data: key, error } = await admin_supabase.from('api_keys')
      .select()
      .eq('id', api_key)
      .eq('dictionary_id', dictionary_id.trim())
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

    const entry_id = crypto.randomUUID()
    const { error: entries_error } = await admin_supabase.from('entries').insert({
      id: entry_id,
      dictionary_id: dictionary_id.trim(),
      lexeme: { default: validated_lexeme },
      created_by: key.created_by,
      updated_by: key.created_by,
    })
    if (entries_error) {
      console.error({ entries_error })
      return kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Failed to create entry: ${entries_error.message}`)
    }

    const { error: stats_error } = await admin_supabase.from('api_keys')
      .update({
        last_write_at: new Date().toISOString(),
        use_count: key.use_count + 1,
      })
      .eq('id', api_key)

    if (stats_error) {
      console.error({ stats_error })
      console.warn('Failed to update API key stats, but entry was created')
    }

    const response: {
      entry_id: string
      entry_url: string
      warnings?: string[]
    } = {
      entry_id,
      entry_url: `${url.origin}/${dictionary_id}/entry/${entry_id}`,
    }

    return json(response)
  } catch (err) {
    if (err.status && err.body) {
      throw err
    }
    console.error('External API error reading entries', err)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Internal server error')
  }
}

function validateLexeme(lexeme: string): string {
  if (typeof lexeme !== 'string') {
    kit_error(ResponseCodes.BAD_REQUEST, 'lexeme must be a string')
  }

  const trimmed = lexeme.trim()
  if (trimmed.length === 0) {
    kit_error(ResponseCodes.BAD_REQUEST, 'lexeme cannot be empty or whitespace only')
  }

  if (trimmed.length > 1000) {
    kit_error(ResponseCodes.BAD_REQUEST, 'lexeme must be less than 1000 characters')
  }

  return trimmed
}
