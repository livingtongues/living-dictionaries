import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { get_shared_db } from '$lib/db/server/shared-db'
import { deliver_system_message } from '$lib/server/chat/system-message'
import { came_through_proxy, internal_token_matches } from '$lib/server/internal-token'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

export interface InternalSystemChatBody {
  room_id: string
  body_html: string
  body_text: string
  /** Usually Jacob's user id — he shouldn't be pinged by his own agent. */
  skip_user_id?: string | null
}

/**
 * Post a System-bot chat message, synchronously, for something already ON THE BOX
 * (Jacob's agent — see the `/system-chat` command).
 *
 * Replaces the `chat_system_outbox` table + its 20s drain cron. The agent runs
 * OUTSIDE the SvelteKit process and so can't reach SES/ntfy itself; it used to
 * bridge that gap with a queue row and then poll `processed_at` to learn the
 * outcome. Now it just calls this and reads the HTTP status — a 200 means posted
 * AND notified, anything else is a real error with a reason.
 *
 * TWO independent gates, because this route is publicly ROUTABLE (Caddy proxies
 * everything to the app; there is no path-level allowlist):
 *  1. `x-internal-token` must match `${DATA_DIR}/.internal-api-token`, which only
 *     exists on the box's data volume and is never web-served.
 *  2. the request must NOT carry proxy headers — i.e. it came straight to the
 *     loopback port, not through Caddy/Cloudflare. So even a leaked token is
 *     useless from off-box.
 * Both fail CLOSED.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (came_through_proxy(request.headers) || !internal_token_matches(request.headers.get('x-internal-token')))
    error(404) // deliberately indistinguishable from "no such route"

  let body: InternalSystemChatBody
  try {
    body = await request.json()
  } catch {
    error(400, 'body must be JSON')
  }

  const { room_id, body_html, body_text, skip_user_id = null } = body ?? {}
  if (!room_id || !body_html || !body_text)
    error(400, 'room_id, body_html and body_text are all required')

  try {
    const { message_id } = await deliver_system_message({
      db: get_shared_db(),
      room_id,
      body_html,
      body_text,
      skip_user_id,
      base_url: SITE_URL,
    })
    return json({ ok: true, message_id })
  } catch (err) {
    // The agent gets the reason in the response; the log review gets it too.
    log_server_event({ level: 'error', message: 'system_chat_delivery_failed', error: err, context: { room_id } })
    error(500, (err as Error).message)
  }
}
