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

// We can extract this function to another file later
function validateRequestBody(body: AddEntryRequestBody): AddEntryRequestBody {
  for (const key of ['api_key', 'dictionary_id', 'lexeme']) {
    if (!body[key]) {
      kit_error(ResponseCodes.BAD_REQUEST, `${key} is required`)
    }
  }

  const { api_key, dictionary_id, lexeme } = body

  if (typeof api_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(api_key)) {
    kit_error(ResponseCodes.BAD_REQUEST, 'api_key must be a valid UUID')
  }

  if (typeof dictionary_id !== 'string' || dictionary_id.trim().length === 0) {
    kit_error(ResponseCodes.BAD_REQUEST, 'dictionary_id must be a non-empty string')
  }

  const validatedLexeme = validateLexeme(lexeme)

  return {
    api_key: api_key.trim(),
    dictionary_id: dictionary_id.trim(),
    lexeme: validatedLexeme,
  }
}

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    let body: AddEntryRequestBody

    try {
      body = await request.json() as AddEntryRequestBody
    } catch {
      kit_error(ResponseCodes.BAD_REQUEST, 'Invalid JSON in request body')
    }

    const validatedBody = validateRequestBody(body)
    const { api_key, dictionary_id, lexeme } = validatedBody

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
      return json(
        { error: `Failed to create entry: ${entries_error.message}` },
        { status: ResponseCodes.INTERNAL_SERVER_ERROR },
      )
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

    return json({ entry_id, entry_url: `${url.origin}/${dictionary_id}/entry/${entry_id}` })
  } catch (err) {
    if (err.status && err.body) {
      throw err
    }
    console.error('Unexpected error in add-entry API:', err)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Internal server error')
  }
}
