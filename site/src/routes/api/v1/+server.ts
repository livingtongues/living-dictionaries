import type { RequestHandler } from './$types'
import { build_front_door } from '$lib/api/v1/front-door'
import { render_front_door_html } from '$lib/api/v1/front-door-html'
import { load_front_door_context } from '$lib/db/server/front-door-context'
import { json } from '@sveltejs/kit'

/**
 * GET /api/v1 — THE front door. Both an agent's and a human's first contact.
 *
 * Returns a small task-routing document (see `$lib/api/v1/front-door.ts`) rather
 * than a reference: pick your job → read its guide → then fetch only the spec
 * slice you need. Content-negotiated from ONE object so the two renderings can't
 * drift.
 *
 * Negotiation: HTML only when `Accept` explicitly asks for `text/html` (browsers
 * do). Bare `curl` and Python `requests` send a wildcard Accept and so get JSON —
 * deliberate, since agents shell out with bare curl constantly and should land on
 * the machine-readable form. `?format=json|html` overrides either way.
 *
 * An API key in `Authorization` is OPTIONAL: present and valid, it names the
 * dictionary and suggests where to start; absent or invalid, the anonymous doc.
 */
export const GET: RequestHandler = (event) => {
  const format = event.url.searchParams.get('format')
  const accept = event.request.headers.get('Accept') ?? ''
  const wants_html = format === 'html' || (format !== 'json' && accept.includes('text/html'))

  const context = load_front_door_context(event.request)
  const doc = build_front_door({ origin: event.url.origin, context: context ?? undefined })

  // A personalized doc names a dictionary — never let it get cached.
  const cache_control = context ? 'private, no-store' : 'public, max-age=300'

  if (wants_html) {
    return new Response(render_front_door_html(doc), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache_control },
    })
  }

  return json(doc, {
    headers: { 'access-control-allow-origin': '*', 'cache-control': cache_control },
  })
}
