import type { RequestHandler } from './$types'
import type { FormAction } from '$lib/db/server/v1-suggestions'
import type { MultiString } from '$lib/types'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_form_action } from '$lib/db/server/v1-suggestions'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1SuggestionsActionsRequestBody {
  /**
   * - `ignore`: mark every non-confirmed occurrence ignored + persist in the
   *   dictionary-level ignore list (future ingests stay ignored)
   * - `restore`: undo an ignore (drops the list row, re-matches occurrences)
   * - `link`: entry-level `confirmed` on every non-confirmed occurrence
   *   (`entry_id` required; NO sense/junction writes — sense links are
   *   per-occurrence via the tokens actions endpoint)
   * - `create_entry`: mint entry + first sense (`lexeme` required), then link
   *   the form everywhere
   */
  action: FormAction
  /** The word form (surface or normalized — normalized-word equality applies). */
  form: string
  entry_id?: string
  lexeme?: MultiString
}

export interface V1SuggestionsActionsResponseBody {
  sentences_changed: number
  occurrences: number
  /** The minted entry id (`create_entry` only). */
  entry_id?: string
}

const FORM_ACTIONS: FormAction[] = ['ignore', 'restore', 'link', 'create_entry']

/** POST /api/v1/dictionaries/[id]/suggestions/actions — form-wide queue actions. Editor+ / write key. */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as V1SuggestionsActionsRequestBody
  if (!FORM_ACTIONS.includes(body.action))
    error(ResponseCodes.BAD_REQUEST, `action must be one of ${FORM_ACTIONS.join(', ')}`)
  if (!body.form || typeof body.form !== 'string')
    error(ResponseCodes.BAD_REQUEST, 'form is required')

  let result
  try {
    result = apply_form_action({
      db: get_dictionary_db(dictionary.id),
      history_db: get_dictionary_history_db(dictionary.id),
      action: body.action,
      form: body.form,
      entry_id: body.entry_id,
      lexeme: body.lexeme,
      user_id: access.user_id,
      api_key_id: access.key_id ?? null,
    })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, (err as Error).message)
  }

  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: result.new_synced_up_to })
  log_server_event({ level: 'info', message: 'v1_suggestion_form_action', user_id: access.user_id, context: { dictionary_id: dictionary.id, action: body.action, form: body.form, occurrences: result.occurrences, via: access.via } })

  return json({
    sentences_changed: result.sentences_changed,
    occurrences: result.occurrences,
    ...(result.entry_id ? { entry_id: result.entry_id } : {}),
  } satisfies V1SuggestionsActionsResponseBody)
}
