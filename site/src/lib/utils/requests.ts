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
    console.error(`[post_request] Network error for ${route}:`, err)
    const is_timeout = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError'
    const message = is_timeout
      ? 'Request timed out - please check your connection and try again'
      : `Network error: ${(err as Error).message}`
    return { data: null, error: { status: 0, message } }
  }
}

export async function get_request<ExpectedResponse extends Record<string, any>>(route: string): Promise<Return<ExpectedResponse>> {
  try {
    const response = await fetch(route, {
      headers: get_default_headers(),
    })
    return handle_response<ExpectedResponse>(response)
  } catch (err) {
    console.error(`[get_request] Network error for ${route}:`, err)
    return { data: null, error: { status: 0, message: `Network error: ${(err as Error).message}` } }
  }
}

async function handle_response<ExpectedResponse extends Record<string, any>>(response: Response): Promise<Return<ExpectedResponse>> {
  const { status } = response
  if (status !== ResponseCodes.OK) {
    const response_clone = response.clone()
    try {
      try {
        const body = await response.json()
        return { data: null, error: { status, message: body.message || JSON.stringify(body) } }
      } catch {
        const text_body = await response_clone.text()
        return { data: null, error: { status, message: text_body } }
      }
    } catch (err) {
      return { data: null, error: { status, message: (err as Error).message } }
    }
  }

  const body = await response.json() as ExpectedResponse
  return { data: body, error: null }
}
