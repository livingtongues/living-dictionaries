import { init_remote_logging, log_event } from '$lib/debug/remote-log'
import { http_status_to_log_level } from '$lib/debug/classify-error'
import { take_client_error } from '$lib/debug/last-client-error'

/**
 * One row per error page render, shared by the root `+error.svelte` and the
 * per-dictionary one. Both boundaries MUST log the same shape — `context.status`
 * is what the analytics side counts, and a 404 inside a dictionary is the single
 * most common one we get.
 */
export function log_error_page({ status, message, url, error_id }: { status: number, message?: string, url?: string, error_id?: string }): void {
  init_remote_logging()
  // `page.error.message` is SvelteKit's sanitized text ("Internal Error") for
  // anything that broke in the BROWSER. `hooks.client.ts` parks the real
  // exception for us; a server-rendered error page parks nothing and instead
  // carries an `error_id` naming the server row that already holds the stack.
  const cause = take_client_error()
  log_event({
    // Map the HTTP status to a severity so expected gates don't read as crashes
    // (shared with the analytics side via `classify-error`).
    level: http_status_to_log_level(status),
    message: message || 'Error page shown',
    stack: cause?.stack ?? null,
    context: {
      status,
      url,
      cause: cause?.message ?? null,
      error_id: error_id ?? null,
      origin: error_id ? 'server' : 'client',
    },
  })
}
