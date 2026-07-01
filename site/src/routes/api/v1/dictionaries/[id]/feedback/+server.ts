import type { RequestHandler } from './$types'
import type { FeedbackKind } from '$lib/server/agent-feedback'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { FEEDBACK_KINDS, FEEDBACK_OWNER_EMAIL, feedback_rate_allows, submit_agent_feedback } from '$lib/server/agent-feedback'
import { log_server_event } from '$lib/server/log-server-event'
import { notify_admin } from '$lib/notifications/notify-admins'
import { error, json } from '@sveltejs/kit'

export interface V1FeedbackRequestBody {
  /** What you need / what's wrong. Required. */
  message: string
  /** Optional category. */
  kind?: FeedbackKind
}

export interface V1FeedbackResponseBody {
  received: true
  /** Sentence the agent should surface to its human. */
  relay_to_human: string
}

/**
 * POST /api/v1/dictionaries/[id]/feedback
 *
 * A channel for AI agents to tell the LD team what they need — a missing field,
 * a bug, an awkward workflow — WITHOUT needing their human to relay it. Available
 * to read AND write keys (access `read`). Lands as an unresolved, assigned
 * support message (see agent-feedback.ts), not a telemetry log. Rate-limited
 * per key so a rogue agent can't flood the inbox. The response asks the agent to
 * tell its human what it requested (we notify the human directly if we adopt it).
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'read' })

  const body = await event.request.json() as V1FeedbackRequestBody
  const message = (body.message || '').trim()
  if (!message)
    error(ResponseCodes.BAD_REQUEST, 'message is required')
  if (message.length > 4000)
    error(ResponseCodes.BAD_REQUEST, 'message too long (max 4000 chars)')
  const kind: FeedbackKind = body.kind && FEEDBACK_KINDS.includes(body.kind) ? body.kind : 'other'

  // Rate-limit per key (fallback to the acting user for a session caller).
  const limiter_key = access.key_id ?? `session:${access.user_id}`
  if (!feedback_rate_allows(limiter_key)) {
    error(ResponseCodes.TOO_MANY_REQUESTS, 'Too much feedback too fast — this is non-blocking; try again later. Your earlier feedback was received.')
  }

  const db = get_shared_db()
  const sender = resolve_sender({ db, user_id: access.user_id, key_id: access.key_id })

  let result
  try {
    result = submit_agent_feedback({
      db,
      dictionary_id: dictionary.id,
      dictionary_name: dictionary.name ?? null,
      key_id: access.key_id ?? `session:${access.user_id}`,
      sender,
      message,
      kind,
    })
  } catch (err) {
    log_server_event({ level: 'error', message: 'v1_feedback_failed', error: err, user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'could not record feedback')
  }

  log_server_event({ level: 'info', message: 'v1_feedback_received', user_id: access.user_id, context: { dictionary_id: dictionary.id, thread_id: result.thread_id, appended: result.appended, kind, via: access.via } })

  void notify_admin({
    email: FEEDBACK_OWNER_EMAIL,
    subject: `Agent feedback: ${dictionary.name ?? dictionary.id}`,
    body: `[${kind}] ${message.slice(0, 240)}`,
    link: `${event.url.origin}/admin/messages/${result.thread_id}`,
  })

  return json({
    received: true,
    relay_to_human: 'I\'ve sent a request to the Living Dictionaries team on your behalf. They\'ll review it and, if adopted, will notify you directly — nothing you need to do right now.',
  } satisfies V1FeedbackResponseBody)
}

function resolve_sender({ db, user_id, key_id }: { db: ReturnType<typeof get_shared_db>, user_id: string, key_id?: string }): { user_id: string | null, email: string, name: string | null } {
  const row = db.prepare(`SELECT id, email, name FROM users WHERE id = ?`).get(user_id) as { id: string, email: string, name: string | null } | undefined
  if (row)
    return { user_id: row.id, email: row.email, name: row.name }
  // Key creator was deleted (synthetic user id) — still record the feedback.
  return { user_id: null, email: `agent+${key_id ?? 'unknown'}@livingdictionaries.app`, name: 'AI agent (key creator removed)' }
}
