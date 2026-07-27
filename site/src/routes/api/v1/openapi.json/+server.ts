import type { RequestHandler } from './$types'
import { build_openapi_spec, select_openapi_view } from '$lib/api/v1/openapi'
import { json } from '@sveltejs/kit'

/**
 * GET /api/v1/openapi.json
 *
 * The machine-readable OpenAPI 3.1 endpoint reference. Public (docs only, no
 * secrets) — auth is described within. NOT the first thing an agent should read:
 * `GET /api/v1` routes it to the guide for its job first.
 *
 * Progressive disclosure (the complete document is ~200KB and growing):
 *  • no query params → the COMPACT INDEX (paths + summaries + schema names).
 *  • `?tag=<name>` → that group's paths + only the schemas they reach.
 *  • `?view=full` → the complete document.
 */
export const GET: RequestHandler = (event) => {
  const spec = build_openapi_spec({ origin: event.url.origin })
  const view = event.url.searchParams.get('view')
  const tag = event.url.searchParams.get('tag')
  return json(select_openapi_view({ spec, view, tag }), {
    headers: { 'access-control-allow-origin': '*' },
  })
}
