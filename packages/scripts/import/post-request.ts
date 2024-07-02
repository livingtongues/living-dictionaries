import { ResponseCodes } from '@living-dictionaries/site/src/lib/constants'

type Return<ExpectedResponse> = {
  data: ExpectedResponse
  error: null
} | {
  data: null
  error: { status: number, message: string }
}

const default_headers: RequestInit['headers'] = {
  'content-type': 'application/json',
}

export async function post_request<T extends Record<string, any>, ExpectedResponse extends Record<string, any> = any>(route: string, data: T, options?: {
  fetch?: typeof fetch
  headers?: RequestInit['headers']
}): Promise<Return<ExpectedResponse>> {
  const fetch_to_use = options?.fetch || fetch

  const response = await fetch_to_use(route, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: options?.headers || default_headers,
  })

  return handleResponse<ExpectedResponse>(response)
}

async function handleResponse<ExpectedResponse extends Record<string, any>>(response: Response): Promise<Return<ExpectedResponse>> {
  const { status } = response
  if (status !== ResponseCodes.OK) {
    const responseClone = response.clone()
    try {
      try {
        const body = await response.json()
        const error = { status, message: body.message || JSON.stringify(body) }
        return { data: null, error }
      } catch {
        const textBody = await responseClone.text()
        return { data: null, error: { status, message: textBody } }
      }
    } catch (err) {
      return { data: null, error: { status, message: err.message } }
    }
  }
}
