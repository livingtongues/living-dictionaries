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
        },
      }],
    })
  } catch {
    // Never let telemetry break the sync path.
  }
}

/** Test-only. */
export function _reset_dict_failure_throttle_for_tests(): void {
  last_shipped = null
}
