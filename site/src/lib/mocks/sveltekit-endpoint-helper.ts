/* eslint-disable require-await */
interface RequestOptions {
  locals?: App.Locals
  params?: Record<string, string>
  method?: 'POST' | 'GET'
  url?: {
    origin?: string
    path?: string
    query?: Record<string, string>
  }
  cookies?: Record<string, string>
  headers?: Record<string, string>
  body?: Record<string, any>
}

type MaybePromise<T> = T | Promise<T>

// : ReturnType<typeof handler>
export function request(handler, options: RequestOptions = {}): MaybePromise<Response> {
  const locals = options.locals || {}
  const params = options.params || {}
  const method = options.method || 'GET'
  const origin = options.url?.origin || 'http://localhost'
  const path = options.url?.path || '/'
  const query = options.url?.query
  const url = new URL(path, origin)
  const cookies = new Map()
  const headers = new Map()
  const formData = options.body instanceof FormData ? options.body : null
  const body = options.body || null
  const text = typeof options.body == 'string' ? options.body : null
  const request = {
    headers,
    method,
    async json() {
      return body
    },
    async text() {
      return text
    },
    async formData() {
      return formData
    },
  }
  const event = { locals, params, cookies, request, url }

  if (query) {
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value)
  }

  if (options.cookies) {
    for (const [key, value] of Object.entries(options.cookies))
      cookies.set(key, value)
  }

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers))
      headers.set(key, value)
  }

  return handler(event)
}
