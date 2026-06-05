import type { ClientLogPayload } from '$lib/server/insert-client-log'
import type { ApiLogRequestBody, ApiLogResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_log(body: ApiLogRequestBody) {
  return await post_request<ApiLogRequestBody, ApiLogResponseBody>('/api/log', body)
}

/**
 * Fire-and-forget log delivery using `navigator.sendBeacon`. Used during
 * `pagehide` / unload paths where a normal fetch would be cancelled by the
 * browser before the request lands. Beacons survive WebView teardown — this
 * is critical for catching the "white flash" iOS crashes.
 *
 * The beacon body is a Blob (not FormData) so the server still parses it as
 * JSON via `request.json()`. `sendBeacon` includes credentials by default, so
 * the httpOnly `session` cookie travels automatically — no URL-token hack.
 *
 * Returns `true` if the browser queued the beacon, `false` otherwise. We
 * never throw — the calling path is already on its way out.
 */
export function send_log_beacon(entries: ClientLogPayload[]): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function')
      return false
    if (!entries.length)
      return true
    const body: ApiLogRequestBody = { entries }
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
    return navigator.sendBeacon('/api/log', blob)
  } catch {
    return false
  }
}
