/**
 * Ship failed admin-engine sync runs to `client_logs` — before this, every
 * "Sync failed: …" lived only in the sync dashboard's UI log and evaporated
 * (cross-repo fix, 2026-07-02; house tracks it in
 * .issues/sync-error-logging-and-corruption-self-heal.md). The admin engine
 * runs on the MAIN thread, so this goes through the normal `log_event`
 * capture (buffered, session_id + breadcrumbs enriched). The worker-side dict
 * engine has its own direct shipper: `../dict-client/report-dict-sync-failure.ts`.
 */
import type { SyncLogEntry, SyncResult } from './types'
import { log_event } from '$lib/debug/remote-log'
import { classify_sync_failure, should_ship_failure, sync_failure_level } from './sync-failure-classify'

let last_shipped: { key: string, at: number } | null = null

function log_tail(entries: SyncLogEntry[], count = 6): string[] {
  return entries.slice(-count).map((entry) => {
    const table = entry.table ? ` ${entry.table}` : ''
    const rows = typeof entry.row_count === 'number' ? ` (${entry.row_count})` : ''
    return `[${entry.level}] ${entry.phase}${table}: ${entry.message}${rows}`
  })
}

/** Call from the engine's finally on a failed run. Fire-and-forget; never throws. */
export function report_sync_failure({ engine, error, result, log_entries }: {
  engine: string
  error: unknown
  result: SyncResult
  log_entries: SyncLogEntry[]
}): void {
  try {
    const kind = classify_sync_failure(error)
    const message = result.error ?? (error as Error)?.message ?? 'unknown sync failure'
    if (!should_ship_failure({ kind, message, last: last_shipped, now: Date.now() }))
      return
    last_shipped = { key: `${kind}:${message}`, at: Date.now() }
    log_event({
      level: sync_failure_level(kind),
      message: 'sync_failed',
      context: {
        engine,
        kind,
        error: message,
        duration_ms: result.duration_ms,
        items_uploaded: result.items_uploaded,
        items_downloaded: result.items_downloaded,
        log_tail: log_tail(log_entries),
      },
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/**
 * Ship a "repeat-fatal circuit breaker tripped" marker
 * (`sync_halted_repeated_failure`) — the admin engine stopped retrying after N
 * identical consecutive non-transient failures (see `RepeatFailureTracker`).
 * Exactly one row per latch, so no throttle needed.
 */
export function report_sync_halted({ message, consecutive }: { message: string, consecutive: number }): void {
  try {
    log_event({
      level: 'error',
      message: 'sync_halted_repeated_failure',
      context: { engine: 'admin', error: message, consecutive },
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/** Test-only. */
export function _reset_throttle_for_tests(): void {
  last_shipped = null
}
