import type { RequestHandler } from './$types'
import { build_openapi_spec } from '$lib/api/v1/openapi'
import { json } from '@sveltejs/kit'

/**
 * GET /api/v1/openapi.json
 *
 * The comprehensive, machine-readable OpenAPI 3.1 spec an agent fetches to
 * self-configure. Public (docs only, no secrets) — auth is described within.
 */
export const GET: RequestHandler = (event) => {
  return json(build_openapi_spec({ origin: event.url.origin }), {
    headers: { 'access-control-allow-origin': '*' },
  })
}
