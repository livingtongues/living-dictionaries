import type { ClientLogLevel } from '$lib/db/schemas/shared.types'

/**
 * One home for "is this logged thing a real fault, and how severe?" — shared by
 * the INGESTION side (`+error.svelte` maps an HTTP status → log level before the
 * row is even sent) and the ANALYTICS side (`log-analytics.ts` folds known-benign
 * and expected-response rows out of the real-error headline). Keeping both paths
 * on the same predicates means a class we decide is noise is noise everywhere.
 */

/**
 * Known-benign error classes folded out of the real-error headline on the
 * dashboard. Seeds: the `/api/log` flush endpoint failing on sleep/redeploy and
 * self-logging; a chunk 404 after a redeploy; the no-WebGL globe failure
 * (the user's GPU/browser can't do WebGL — nothing we can fix, not a crash);
 * and the Node HTTP `abortIncoming` socket close (`aborted`) when a client
 * disconnects mid-request (also demoted to `info` at the source in
 * `hooks.server.ts`, so this mainly catches legacy rows); and adapter-node's
 * oversized-body rejection (`Content-length … exceeds limit of … bytes`) — a
 * scanner/abuse probe POSTing a giant body is correctly rejected, not a fault.
 */
export const KNOWN_NOISE_PATTERNS = [
  'Network error for /api/log',
  'Failed to fetch dynamically imported module',
  'WebGL unavailable',
  'Failed to initialize WebGL',
  'aborted',
  'exceeds limit of',
  // The masked cross-origin window.onerror ("Script error." with no filename/
  // stack) — a third-party script (extension, SDK loaded without CORS) threw.
  // Zero actionable signal beyond breadcrumbs; keep shipping the rows (the
  // breadcrumbs located a recording-flow correlation on 2026-07-03) but fold
  // them out of the real-error headline.
  'Script error.',
  // Safari surfaces a failed resource/network load as a bare `Event` (no Error
  // object) → serialized to `{"isTrusted":true}`, or its generic fetch failure
  // `Load failed`. Both are opaque transient network/resource blips with no
  // actionable stack (observed 2026-07-04 during sign-in on flaky connections).
  '{"isTrusted":true}',
  'Load failed',
]

export function is_known_noise(message: string): boolean {
  return KNOWN_NOISE_PATTERNS.some(pattern => message.includes(pattern))
}

/**
 * Map an HTTP status to a log severity so EXPECTED gates don't read as crashes:
 * 5xx = crash (a real failure), 401/403 = warn (auth gate, e.g. an anon user
 * hitting `/admin/*`), 404 = info, anything else = error. Used by `+error.svelte`
 * at the moment a SvelteKit error page is shown — i.e. at the source, before the
 * row is logged.
 */
export function http_status_to_log_level(status: number): ClientLogLevel {
  if (status >= 500)
    return 'crash'
  if (status === 401 || status === 403)
    return 'warn'
  if (status === 404)
    return 'info'
  return 'error'
}

/**
 * Classify a logged error `message` as an EXPECTED HTTP response rather than a
 * real JS fault. SvelteKit `error(status, …)` thrown from a load/endpoint reaches
 * `client_logs` as either a serialized error object
 * (`{"type":"error","error":{…},"status":403}`) or the framework's bare 404 text
 * (`Not found: /some/path`). These are the app behaving correctly — a permission
 * wall, a prefetch of a gated route, a missing attachment — NOT a crash.
 *
 * `+error.svelte` already demotes these at the source, but a row reaching an
 * error level by another path (e.g. a server endpoint logging a 404 at `error`)
 * is still folded into the error-cluster `is_noise` flag via this predicate.
 *
 * Kept deliberately tight to the two observed shapes + the 4xx-client status set;
 * 5xx stays a real error (those ARE faults worth surfacing).
 */
const EXPECTED_STATUSES = new Set([400, 401, 403, 404, 410])

export function is_expected_error_response(message: string | null | undefined): boolean {
  if (!message)
    return false
  // SvelteKit's bare 404 message: `Not found: /path`.
  if (message.startsWith('Not found: /'))
    return true
  // Serialized `error()` response — only attempt JSON when it looks like one.
  if (message.startsWith('{') && message.includes('"status"')) {
    try {
      const parsed = JSON.parse(message) as { status?: unknown }
      if (typeof parsed.status === 'number' && EXPECTED_STATUSES.has(parsed.status))
        return true
    } catch {
      // Not valid JSON — fall through to false.
    }
  }
  return false
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe(is_known_noise, () => {
    it('flags the /api/log flush blip and chunk-load failures', () => {
      expect(is_known_noise('[post_request] Network error for /api/log: timeout')).toBe(true)
      expect(is_known_noise('Failed to fetch dynamically imported module: /_app/x.js')).toBe(true)
    })
    it('flags the no-WebGL globe failures', () => {
      expect(is_known_noise('Map failed to load (WebGL unavailable)')).toBe(true)
      expect(is_known_noise('Failed to initialize WebGL')).toBe(true)
    })
    it('flags the server client-disconnect socket abort', () => {
      expect(is_known_noise('aborted')).toBe(true)
    })
    it('flags adapter-node oversized-body rejections', () => {
      expect(is_known_noise('Content-length of 17000012 exceeds limit of 16777216 bytes.')).toBe(true)
    })
    it('flags the masked cross-origin Script error.', () => {
      expect(is_known_noise('Script error.')).toBe(true)
    })
    it('flags Safari bare-Event / generic network-load failures', () => {
      expect(is_known_noise('{"isTrusted":true}')).toBe(true)
      expect(is_known_noise('Load failed')).toBe(true)
    })
    it('does NOT flag a genuine fault', () => {
      expect(is_known_noise("Cannot read properties of undefined (reading 'x')")).toBe(false)
      expect(is_known_noise('Internal Error')).toBe(false)
    })
  })

  describe(http_status_to_log_level, () => {
    it('maps 5xx to crash', () => {
      expect(http_status_to_log_level(500)).toBe('crash')
      expect(http_status_to_log_level(503)).toBe('crash')
    })
    it('maps auth gates 401/403 to warn', () => {
      expect(http_status_to_log_level(401)).toBe('warn')
      expect(http_status_to_log_level(403)).toBe('warn')
    })
    it('maps 404 to info', () => {
      expect(http_status_to_log_level(404)).toBe('info')
    })
    it('maps anything else to error', () => {
      expect(http_status_to_log_level(400)).toBe('error')
      expect(http_status_to_log_level(418)).toBe('error')
    })
  })

  describe(is_expected_error_response, () => {
    it('flags serialized 4xx error() responses', () => {
      expect(is_expected_error_response('{"type":"error","error":{"message":"Manager only"},"status":403}')).toBe(true)
      expect(is_expected_error_response('{"status":404,"error":{"message":"x"}}')).toBe(true)
      expect(is_expected_error_response('{"status":401}')).toBe(true)
    })
    it('flags the bare SvelteKit 404 text', () => {
      expect(is_expected_error_response('Not found: /api/messages/attachments/a3b4bb8c-d145')).toBe(true)
    })
    it('does NOT flag 5xx responses or real faults', () => {
      expect(is_expected_error_response('{"type":"error","error":{},"status":500}')).toBe(false)
      expect(is_expected_error_response("Cannot read properties of undefined (reading 'x')")).toBe(false)
      expect(is_expected_error_response('Internal Error')).toBe(false)
    })
    it('handles empty / malformed input safely', () => {
      expect(is_expected_error_response(null)).toBe(false)
      expect(is_expected_error_response('')).toBe(false)
      expect(is_expected_error_response('{not json "status"')).toBe(false)
    })
  })
}
