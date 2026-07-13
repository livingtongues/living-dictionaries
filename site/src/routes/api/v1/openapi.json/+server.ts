import type { RequestHandler } from './$types'
import { build_openapi_spec, select_openapi_view } from '$lib/api/v1/openapi'
import { json } from '@sveltejs/kit'

/**
 * GET /api/v1/openapi.json
 *
 * The comprehensive, machine-readable OpenAPI 3.1 spec an agent fetches to
 * self-configure. Public (docs only, no secrets) — auth is described within.
 *
 * Progressive disclosure (the full spec is large + growing):
 *  • `?view=index` → a compact map (paths + summaries + schema names only).
 *  • `?tag=<name>` → just that group's paths, with full ($ref-complete) schemas.
 *  • no query params → the complete spec (backward-compatible default).
 */
export const GET: RequestHandler = (event) => {
  const spec = build_openapi_spec({ origin: event.url.origin })
  const view = event.url.searchParams.get('view')
  const tag = event.url.searchParams.get('tag')
  return json(select_openapi_view({ spec, view, tag }), {
    headers: { 'access-control-allow-origin': '*' },
  })
}
