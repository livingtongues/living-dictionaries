import { ResponseCodes } from '$lib/constants'

function get_default_headers(): Record<string, string> {
  return { 'content-type': 'application/json' }
}

type Return<ExpectedResponse> = {
  data: ExpectedResponse
  error: null
} | {
  data: null
  error: { status: number, message: string }
}

export async function post_request<T extends Record<string, any>, ExpectedResponse extends Record<string, any>>(route: string, data: T, options?: {
  headers?: RequestInit['headers']
  signal?: AbortSignal
  /**
   * Emit a `console.error` on network failure. Default `true`. Set `false` for
   * the remote-log shipper's own POST to `/api/log` — otherwise a transient
   * transport failure (e.g. the socket dropped mid-flight by a Docker redeploy)
   * both spams the console AND, because `console.error` is patched to ship logs,
   * gets re-buffered as a self-referential error row that re-ships on the next
   * flush. The buffer already retries the batch, so the failure isn't lost.
   */
  log_errors?: boolean
}): Promise<Return<ExpectedResponse>> {
  try {
    const response = await fetch(route, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { ...get_default_headers(), ...options?.headers },
      signal: options?.signal,
    })
    return handle_response<ExpectedResponse>(response)
  } catch (err) {
    if (options?.log_errors !== false)
      console.error(`[post_request] Network error for ${route}:`, err)
    const is_timeout = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError'
    const message = is_timeout
      ? 'Request timed out - please check your connection and try again'
      : `Network error: ${(err as Error).message}`
    return { data: null, error: { status: 0, message } }
  }
}

export async function get_request<ExpectedResponse extends Record<string, any>>(route: string, options?: {
  /**
   * Custom fetch — pass a SvelteKit universal-load `fetch` so SSR calls run
   * in-process and forward the incoming request's cookies (auth). Defaults to
   * the global `fetch`.
   */
  fetch?: typeof fetch
  headers?: RequestInit['headers']
  signal?: AbortSignal
  /**
   * Emit a `console.error` on network failure. Default `true`. Set `false` for
   * chatty pollers (e.g. the team-chat rooms/messages polls) whose transient
   * transport failures during a Docker redeploy would otherwise spam the
   * console AND, because `console.error` is patched to ship logs, re-ship as
   * self-referential error rows. The poller retries on its next interval, so
   * the failure isn't lost. Mirrors `post_request`'s `log_errors`.
   */
  log_errors?: boolean
}): Promise<Return<ExpectedResponse>> {
  const fetch_fn = options?.fetch ?? fetch
  try {
    const response = await fetch_fn(route, {
      headers: { ...get_default_headers(), ...options?.headers },
      signal: options?.signal,
    })
    return handle_response<ExpectedResponse>(response)
  } catch (err) {
    if (options?.log_errors !== false)
      console.error(`[get_request] Network error for ${route}:`, err)
    return { data: null, error: { status: 0, message: `Network error: ${(err as Error).message}` } }
  }
}

async function handle_response<ExpectedResponse extends Record<string, any>>(response: Response): Promise<Return<ExpectedResponse>> {
  const { status } = response
  if (status !== ResponseCodes.OK) {
    const response_clone = response.clone()
    try {
      const body = await response.json()
      return { data: null, error: { status, message: body.message || JSON.stringify(body) } }
    } catch {
      const text_body = await response_clone.text().catch(() => '')
      return { data: null, error: { status, message: friendly_non_json_error({ status, text_body }) } }
    }
  }

  const body = await response.json() as ExpectedResponse
  return { data: body, error: null }
}

/**
 * Build a human-friendly message for an error response whose body wasn't our
 * JSON `{ message }` shape. This happens when the request never reached our
 * SvelteKit origin — e.g. Cloudflare/Caddy serving an HTML error page
 * (502/503/521/522/524) while the origin is momentarily unreachable during a
 * blue/green redeploy, or a request the edge timed out. Dumping that raw HTML
 * (a full `<!DOCTYPE html>…` Cloudflare page) into an `alert`/toast is useless,
 * so collapse it to a concise, actionable line. Genuine short plain-text bodies
 * are passed through (capped) since they may carry a real message.
 */
function friendly_non_json_error({ status, text_body }: { status: number, text_body: string }): string {
  const trimmed = text_body.trim()
  const looks_like_html = /^<(?:!doctype|!--|html|head|body)/i.test(trimmed)
  if (!trimmed || looks_like_html)
    return `The server is temporarily unavailable (${status}). Please try again in a moment.`
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed
}
