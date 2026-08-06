import type { HandleClientError } from '@sveltejs/kit'
import { missing_build_artifact_reason } from '$lib/db/client/stale-build-artifact'
import { remember_client_error } from '$lib/debug/last-client-error'
import { log_event } from '$lib/debug/remote-log'

/**
 * Browser-side twin of `hooks.server.ts`'s `handleError`.
 *
 * WHY (2026-08-01): `remote-log.ts` patches `window.error`,
 * `window.unhandledrejection` and `console.error`, which covers raw browser
 * exceptions well — but SvelteKit catches faults in its OWN load/render path and
 * routes them here instead, and until now there was no `hooks.client.ts` at all,
 * so those reached nothing. That was the whole of the "no server-side record of
 * any 500" mystery: production held 403 `Internal Error` crash rows and ZERO
 * server `crash` rows, because 399 of them fired within 2 s of `session_start` —
 * SvelteKit's own 500 page, raised in the browser during hydration, with the real
 * exception discarded. Worse, a hydration failure can predate
 * `init_remote_logging()`, so even the `console.error` the default handler does
 * was not always captured. See `.issues/ssr-500-has-no-server-side-record.md`.
 *
 * Two jobs, both cheap:
 *   1. log the real message + stack + route as `client_error: …`, mirroring the
 *      server hook's context shape so one classification covers both halves.
 *      `log_event` buffers pre-init and replays on `init_remote_logging()`, so a
 *      hydration-time fault still ships.
 *   2. park the cause for `+error.svelte`, so the `crash` row that follows names
 *      what actually broke instead of standing alone as "Internal Error".
 *
 * DELIBERATELY NO RECOVERY ACTION HERE. This repo's reload-once rule for deleted
 * build artifacts lives in the DATA layer (`$lib/db/client/stale-build-artifact.ts`
 * → `$lib/db/dict-client/stale-bundle-recovery.ts`, wired into `dict-session.ts`),
 * where it can see the leader-worker boot ladder. A second reload mechanism here
 * would race it and double-spend its one-reload guard. The classifier is used
 * only to LABEL the row (`stale_build: true`) so triage can separate a stale-bundle
 * import failure from a genuine app fault.
 *
 * SvelteKit's default client handler `console.error`s the raw error, which the
 * console patch already captured — so this REPLACES that row rather than adding
 * one.
 */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
  // A 404 is ordinary user churn (a stale deep link), not a fault.
  if (status === 404)
    return { message }

  const error_message = (error as Error)?.message || message || 'unknown'
  const stack = (error as Error)?.stack ?? null

  remember_client_error({ message: error_message, stack })
  log_event({
    level: 'error',
    message: `client_error: ${error_message}`,
    stack,
    context: {
      route: event.route?.id ?? null,
      path: event.url?.pathname ?? null,
      status,
      stale_build: !!missing_build_artifact_reason({ message: error_message, online: navigator.onLine }),
    },
  })
  // The same public text SvelteKit would have produced — `+error.svelte` renders
  // it, and its ABSENT `error_id` is what marks the fault as browser-side.
  return { message }
}
