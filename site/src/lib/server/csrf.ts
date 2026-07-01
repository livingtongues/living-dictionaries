import type { RequestEvent } from '@sveltejs/kit'

/**
 * CSRF origin check for form-content-type submissions — a faithful
 * re-implementation of SvelteKit's built-in guard (which we disable globally via
 * `kit.csrf.trustedOrigins: ['*']` in svelte.config.js) with ONE carve-out.
 *
 * SvelteKit's guard runs inside `internal_respond` BEFORE our `handle` hook, so a
 * per-route exemption is impossible while it's on; and it forbids ANY form POST
 * whose `Origin` doesn't match — including requests with NO `Origin` header, which
 * is exactly what a server-side `/api/v1` client (curl/Python/fetch) sends. That
 * made token-authenticated `multipart/form-data` media uploads a false-positive
 * 403 in production.
 *
 * The carve-out: exempt `/api/v1/*` requests that carry an `Authorization` header.
 * Browsers never auto-attach `Authorization`, and cross-origin JS can't set it on a
 * simple form POST without a CORS preflight — so a Bearer request is provably not a
 * forged cookie-riding submission (the thing CSRF protects against). Every
 * cookie-authenticated form POST keeps full protection.
 *
 * Pure (no `dev` gate) so it's unit-testable; the caller applies the prod-only gate,
 * mirroring SvelteKit (CSRF checks only apply in production).
 */

const FORM_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  // SvelteKit's own binary form-action content type.
  'application/x-sveltekit-formdata',
])

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function is_cross_origin_form_forbidden(event: Pick<RequestEvent, 'request' | 'url'>): boolean {
  const { request, url } = event
  if (!UNSAFE_METHODS.has(request.method))
    return false

  const content_type = (request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
  if (!FORM_CONTENT_TYPES.has(content_type))
    return false

  if (request.headers.get('origin') === url.origin)
    return false

  // Token-authenticated v1 API calls aren't cookie-riding forgeries — exempt them.
  if (url.pathname.startsWith('/api/v1/') && request.headers.get('authorization'))
    return false

  return true
}
