import type Database from 'better-sqlite3'
import type { ClientLogLevel } from '$lib/db/schemas/shared.types'
import { insert_client_log } from './insert-client-log'

/**
 * Record a server-side telemetry entry into the same `client_logs` table as
 * browser logs, tagged `source = 'server'`. The server analog of the client
 * `log_event()` / `track()` — gives API failures, sync errors, cron outcomes,
 * and slow server timings a queryable home instead of vanishing into ephemeral
 * `docker logs`. Read it back with the `log-and-fix` review (filter
 * `source = 'server'`).
 *
 * Never throws — logging must not spawn more errors. Pass an `Error` for `error`
 * to capture its message + stack without boilerplate at the call site.
 */
export function log_server_event({ level, message, error, context, user_id = null, db }: {
  level: ClientLogLevel
  message: string
  error?: unknown
  context?: Record<string, unknown> | null
  user_id?: string | null
  /** A LOGS db handle (tests / sync-helpers). NEVER pass shared.db — client_logs was split out of it 2026-07-05. */
  db?: Database.Database
}): void {
  try {
    const err = error instanceof Error ? error : null
    insert_client_log({
      payload: {
        level,
        message: message || err?.message || 'server event',
        stack: err?.stack ?? null,
        context: context ?? null,
      },
      user_id,
      source: 'server',
      ...(db ? { db } : {}),
    })
  } catch {
    // Swallow — server logging must never throw.
  }
}
