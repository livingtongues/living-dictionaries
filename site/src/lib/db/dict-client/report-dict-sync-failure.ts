/**
 * Worker-safe telemetry for dict-engine sync failures. The per-dict sync
 * engine runs inside the leader dedicated worker where `remote-log`'s
 * localStorage buffer doesn't exist (its push silently drops) — before this,
 * a failing dict sync only ever reached `console.warn` in the worker and
 * evaporated. Ships straight to `POST /api/log` (the same-origin session
 * cookie auto-attaches to worker fetch, so rows are user-attributed).
 *
 * The dict engine auto-retries every 30s (`DICT_SYNC_INTERVAL_MS`), so:
 *  - pure offline failures are NOT shipped at all (`navigator.onLine` false);
 *  - throttled kinds (network / server_outdated / auth / snapshot_expired)
 *    suppress repeat-identical rows for 10 minutes.
 *
 * Never throws — telemetry must not spawn more errors.
 */
import { api_log } from '$api/log/_call'
import { version } from '$app/environment'
import { classify_sync_failure, should_ship_failure, sync_failure_level } from '$lib/db/sync/sync-failure-classify'

let last_shipped: { key: string, at: number } | null = null

/**
 * The spawning tab's remote-log `session_id`, threaded through the worker init
 * (`InstanceOptions.session_id`) so worker-emitted rows can be correlated with
 * the leader tab's session in `client_logs` — they otherwise carry no session
 * at all (the 2026-07-03 review couldn't tie 112 worker rows to any session).
 */
let worker_session_id: string | null = null

export function set_dict_log_session(session_id: string | null | undefined): void {
  worker_session_id = session_id ?? null
}

function safe_user_agent(): string | null {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null
  } catch {
    return null
  }
}

function is_offline(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  } catch {
    return false
  }
}

/** Ship a failed dict sync to `client_logs`. Fire-and-forget; never throws. */
export function report_dict_sync_failure({ dict_id, error }: {
  dict_id: string
  error: unknown
}): void {
  try {
    const kind = classify_sync_failure(error)
    if (kind === 'network' && is_offline())
      return // expected — the 30s interval retries when the connection returns
    const message = (error as Error)?.message ?? 'unknown sync failure'
    if (!should_ship_failure({ kind, message, last: last_shipped, now: Date.now() }))
      return
    last_shipped = { key: `${kind}:${message}`, at: Date.now() }
    void api_log({
      entries: [{
        level: sync_failure_level(kind),
        message: 'sync_failed',
        client_time: new Date().toISOString(),
        user_agent: safe_user_agent(),
        platform: 'web',
        app_version: version ?? null,
        context: {
          worker: true,
          engine: 'dict',
          dict_id,
          kind,
          error: message,
          status: typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined,
          session_id: worker_session_id ?? undefined,
        },
      }],
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/**
 * Ship a "dirty rows aren't draining" warning — pending local writes observed
 * across consecutive watchdog checks (see `DictSyncEngine` stuck-dirty
 * watchdog). This is the durable early-warning for the "user keeps editing
 * but nothing reaches the server" class (auth silently broken, a table the
 * push loop misses, engine wedged) that per-attempt `sync_failed` rows can
 * miss. Throttled to one row per `STUCK_DIRTY_THROTTLE_MS`.
 */
export const STUCK_DIRTY_THROTTLE_MS = 30 * 60 * 1000
let stuck_last_shipped_at = 0

export function report_dict_stuck_dirty({ dict_id, dirty_rows, deletes, last_sync_at, last_error }: {
  dict_id: string
  dirty_rows: number
  deletes: number
  last_sync_at: string | null
  last_error: string | null
}): void {
  try {
    if (is_offline())
      return
    const now = Date.now()
    if (now - stuck_last_shipped_at < STUCK_DIRTY_THROTTLE_MS)
      return
    stuck_last_shipped_at = now
    void api_log({
      entries: [{
        level: 'warn',
        message: 'dirty_rows_stuck',
        client_time: new Date().toISOString(),
        user_agent: safe_user_agent(),
        platform: 'web',
        app_version: version ?? null,
        context: { worker: true, engine: 'dict', dict_id, dirty_rows, deletes, last_sync_at, last_error, session_id: worker_session_id ?? undefined },
      }],
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/**
 * Ship a "repeat-fatal circuit breaker tripped" marker
 * (`sync_halted_repeated_failure`) — the engine stopped retrying after N
 * identical consecutive non-transient failures (see `RepeatFailureTracker`).
 * Exactly one row per latch (the engine fires `on_repeated_failure` once), so
 * no throttle needed. This is the loud "an editor is wedged RIGHT NOW" signal
 * the per-attempt `sync_failed` rows only imply in aggregate.
 */
export function report_dict_sync_halted({ dict_id, message, consecutive }: {
  dict_id: string
  message: string
  consecutive: number
}): void {
  try {
    void api_log({
      entries: [{
        level: 'error',
        message: 'sync_halted_repeated_failure',
        client_time: new Date().toISOString(),
        user_agent: safe_user_agent(),
        platform: 'web',
        app_version: version ?? null,
        context: { worker: true, engine: 'dict', dict_id, error: message, consecutive, session_id: worker_session_id ?? undefined },
      }],
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/**
 * Ship a "reopened the OPFS connection after the browser closed our access
 * handle" marker (`storage_lost` self-heal in `dict-instance.ts`) — the
 * observability that the recovery path actually ran in the wild.
 */
export function report_dict_storage_reopened({ dict_id, attempt }: { dict_id: string, attempt: number }): void {
  try {
    void api_log({
      entries: [{
        level: 'info',
        message: 'dict_connection_reopened',
        client_time: new Date().toISOString(),
        user_agent: safe_user_agent(),
        platform: 'web',
        app_version: version ?? null,
        context: { worker: true, engine: 'dict', dict_id, attempt, session_id: worker_session_id ?? undefined },
      }],
    })
  } catch {
    // Never let telemetry break the recovery path.
  }
}

/** Test-only. */
export function _reset_dict_failure_throttle_for_tests(): void {
  last_shipped = null
  stuck_last_shipped_at = 0
}
