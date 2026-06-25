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
  // Set false on background polls so a transient network failure during a
  // redeploy doesn't spam the console (the poll retries on its next interval).
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
  // Pass a SvelteKit load's injected `fetch` so server-side loads keep the
  // direct-handler + HTML-inlining optimization (no real HTTP round-trip on SSR,
  // no refetch on hydration). Defaults to the global `fetch`.
  fetch?: typeof fetch
  // Set false on background polls so a transient network failure during a
  // redeploy doesn't spam the console (the poll retries on its next interval).
  log_errors?: boolean
}): Promise<Return<ExpectedResponse>> {
  const fetcher = options?.fetch ?? fetch
  try {
    const response = await fetcher(route, {
      headers: get_default_headers(),
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
 * redeploy, or a request the edge timed out. Dumping that raw HTML (a full
 * `<!DOCTYPE html>…` Cloudflare page) into an `alert`/toast is useless, so
 * collapse it to a concise, actionable line. Genuine short plain-text bodies
 * are passed through (capped) since they may carry a real message.
 */
function friendly_non_json_error({ status, text_body }: { status: number, text_body: string }): string {
  const trimmed = text_body.trim()
  const looks_like_html = /^<(?:!doctype|!--|html|head|body)/i.test(trimmed)
  if (!trimmed || looks_like_html)
    return `The server is temporarily unavailable (${status}). Please try again in a moment.`
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed
}
