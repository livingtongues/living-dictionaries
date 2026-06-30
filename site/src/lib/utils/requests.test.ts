import { post_request } from './requests'

describe(post_request, () => {
  const original_fetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = original_fetch
    vi.restoreAllMocks()
  })

  test('returns a network error and logs it on a rejected fetch', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    const console_error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { data, error } = await post_request('/api/whatever', { a: 1 })

    expect(data).toBe(null)
    expect(error).toEqual({ status: 0, message: 'Network error: Failed to fetch' })
    expect(console_error).toHaveBeenCalledTimes(1)
  })

  test('suppresses the console.error when log_errors is false', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    const console_error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { data, error } = await post_request('/api/whatever', { a: 1 }, { log_errors: false })

    // Still returns the error so the caller (the log shipper) keeps its buffer to retry.
    expect(data).toBe(null)
    expect(error).toEqual({ status: 0, message: 'Network error: Failed to fetch' })
    expect(console_error).not.toHaveBeenCalled()
  })

  test('surfaces the JSON `message` field on a structured error response', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(
      new Response(JSON.stringify({ message: 'not allowed' }), { status: 403 }),
    )) as unknown as typeof fetch

    const { data, error } = await post_request('/api/whatever', { a: 1 })

    expect(data).toBe(null)
    expect(error).toEqual({ status: 403, message: 'not allowed' })
  })

  test('collapses an HTML error page (Cloudflare 5xx) to a concise message instead of dumping raw HTML', async () => {
    const cloudflare_page = '<!DOCTYPE html>\n<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->\n<html><head><title>522</title></head><body>error</body></html>'
    globalThis.fetch = vi.fn(() => Promise.resolve(
      new Response(cloudflare_page, { status: 522, headers: { 'content-type': 'text/html' } }),
    )) as unknown as typeof fetch

    const { data, error } = await post_request('/api/whatever', { a: 1 })

    expect(data).toBe(null)
    expect(error).toEqual({ status: 522, message: 'The server is temporarily unavailable (522). Please try again in a moment.' })
  })

  test('falls back to a status message on an empty error body', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(
      new Response('', { status: 502 }),
    )) as unknown as typeof fetch

    const { data, error } = await post_request('/api/whatever', { a: 1 })

    expect(data).toBe(null)
    expect(error).toEqual({ status: 502, message: 'The server is temporarily unavailable (502). Please try again in a moment.' })
  })

  test('passes through a short plain-text error body', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(
      new Response('rate limited, slow down', { status: 429 }),
    )) as unknown as typeof fetch

    const { data, error } = await post_request('/api/whatever', { a: 1 })

    expect(data).toBe(null)
    expect(error).toEqual({ status: 429, message: 'rate limited, slow down' })
  })
})
