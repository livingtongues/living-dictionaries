import { describe, expect, test } from 'vitest'
import { is_cross_origin_form_forbidden } from './csrf'

function event({ method = 'POST', content_type, origin, authorization, path = '/api/v1/dictionaries/d1/entries/e1/audio' }: {
  method?: string
  content_type?: string
  origin?: string
  authorization?: string
  path?: string
}) {
  const headers = new Headers()
  if (content_type)
    headers.set('content-type', content_type)
  if (origin)
    headers.set('origin', origin)
  if (authorization)
    headers.set('authorization', authorization)
  const url = new URL(`https://livingdictionaries.app${path}`)
  return { request: new Request(url, { method, headers }), url }
}

describe(is_cross_origin_form_forbidden, () => {
  test('forbids a cross-origin multipart form POST', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data; boundary=x', origin: 'https://evil.com', path: '/some/action' }))).toBeTruthy()
  })

  test('forbids a multipart POST with no Origin header (server client) on a non-v1 route', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data', path: '/some/action' }))).toBeTruthy()
  })

  test('allows same-origin form posts', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data', origin: 'https://livingdictionaries.app', path: '/some/action' }))).toBeFalsy()
  })

  test('allows JSON posts (not a form content type) regardless of origin', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'application/json', origin: 'https://evil.com' }))).toBeFalsy()
  })

  test('allows GET regardless', () => {
    expect(is_cross_origin_form_forbidden(event({ method: 'GET', content_type: 'multipart/form-data', origin: 'https://evil.com', path: '/some/action' }))).toBeFalsy()
  })

  test('carve-out: token-authed /api/v1 multipart upload with no Origin is allowed', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data', authorization: 'Bearer ldk_abc' }))).toBeFalsy()
  })

  test('carve-out does NOT apply to /api/v1 without an Authorization header', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data' }))).toBeTruthy()
  })

  test('carve-out does NOT apply outside /api/v1 even with an Authorization header', () => {
    expect(is_cross_origin_form_forbidden(event({ content_type: 'multipart/form-data', authorization: 'Bearer x', path: '/some/action' }))).toBeTruthy()
  })

  test('covers urlencoded, text/plain, and sveltekit binary form types', () => {
    for (const content_type of ['application/x-www-form-urlencoded', 'text/plain', 'application/x-sveltekit-formdata']) {
      expect(is_cross_origin_form_forbidden(event({ content_type, path: '/some/action' }))).toBeTruthy()
    }
  })
})
