import type { RequestHandler } from './$types'
import type { ClientLogPayload } from '$lib/server/insert-client-log'
import { verify_jwt } from '$lib/auth/jwt'
import { ResponseCodes } from '$lib/constants'
import { insert_client_log, rate_limit_allow } from '$lib/server/insert-client-log'
import { json } from '@sveltejs/kit'

export interface ApiLogRequestBody {
  /** Single entry, or — preferred — a batch under `entries`. */
  level?: ClientLogPayload['level']
  message?: string
  client_time?: ClientLogPayload['client_time']
  stack?: ClientLogPayload['stack']
  url?: ClientLogPayload['url']
  user_agent?: ClientLogPayload['user_agent']
  platform?: ClientLogPayload['platform']
  app_version?: ClientLogPayload['app_version']
  build_target?: ClientLogPayload['build_target']
  context?: ClientLogPayload['context']
  entries?: ClientLogPayload[]
}

export interface ApiLogResponseBody {
  ok: true
  accepted: number
  rate_limited?: true
}

const MAX_BATCH_SIZE = 50

/**
 * POST /api/log — accept client-side error reports.
 *
 * Auth is OPTIONAL: a valid Bearer token (or `session` cookie) attributes the
 * entry to a `user_id`, but missing/invalid tokens are silently allowed (logs
 * from broken-auth or pre-login flows are the most informative). The endpoint
 * never throws — logging must not spawn more errors. Always returns
 * `{ ok: true, accepted: N }` with status 200, even on malformed /
 * rate-limited input.
 *
 * Hardening:
 *  - Per-IP token bucket (~30/min steady-state) drops the body wholesale on burst abuse.
 *  - Batch capped at MAX_BATCH_SIZE; oversize batches silently truncate.
 *  - Malformed entries (missing level/message, unknown level) are dropped.
 */
export const POST: RequestHandler = async (event) => {
  const ip = safe_get_client_address(event)
  if (!rate_limit_allow({ ip })) {
    return json({ ok: true, accepted: 0, rate_limited: true } satisfies ApiLogResponseBody, {
      status: ResponseCodes.OK,
    })
  }

  // Optional auth: extract user_id if a valid session is present, else null.
  // Beacons send the httpOnly cookie automatically (credentials:'include' is
  // the default for sendBeacon) so no URL-token workaround is needed.
  const user_id = await maybe_user_id(event)

  let body: ApiLogRequestBody
  try {
    body = await event.request.json() as ApiLogRequestBody
  } catch {
    // Malformed JSON — accept-with-zero so misbehaving clients learn nothing
    // useful from response status, and we don't fill logs with parse errors.
    return json({ ok: true, accepted: 0 } satisfies ApiLogResponseBody)
  }

  const entries = Array.isArray(body?.entries)
    ? body.entries.slice(0, MAX_BATCH_SIZE)
    : extract_single_entry(body)

  let accepted = 0
  for (const entry of entries) {
    if (insert_client_log({ payload: entry, user_id }))
      accepted++
  }

  return json({ ok: true, accepted } satisfies ApiLogResponseBody)
}

function extract_single_entry(body: ApiLogRequestBody | null): ClientLogPayload[] {
  if (!body || !body.level || !body.message)
    return []
  const { entries: _entries, ...rest } = body
  return [rest as ClientLogPayload]
}

async function maybe_user_id(event: { request: Request, cookies?: { get: (name: string) => string | undefined } }): Promise<string | null> {
  let token: string | null = event.cookies?.get('session') ?? null
  if (!token) {
    const auth_header = event.request.headers.get('Authorization')
    if (auth_header && auth_header.startsWith('Bearer '))
      token = auth_header.slice('Bearer '.length) || null
  }
  if (!token)
    return null
  try {
    const payload = await verify_jwt(token)
    return payload.sub ?? null
  } catch {
    return null
  }
}

function safe_get_client_address(event: { getClientAddress?: () => string }): string {
  try {
    return event.getClientAddress?.() ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
