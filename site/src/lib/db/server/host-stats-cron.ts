import { log_server_event } from '$lib/server/log-server-event'
import { read_host_stats } from '$lib/server/host-stats'

/**
 * Whole-box resource telemetry: every 5 min, log one `host_stats` server event
 * (CPU / RAM / swap / disk / load / data-dir size — see host-stats.ts for how a
 * container reads HOST-wide values) into `client_logs`. The /admin/health "Host
 * resources" panel charts these over the 14-day hot window; retention treats
 * them like any other row (hot → archive → prune). ~288 tiny rows/day.
 *
 * CPU%: the cron's own tracker baseline means each event carries the TRUE
 * average CPU over the full 5-min window (cumulative /proc/stat counters), not
 * a point-in-time blink — a 30s spike shows up in that window's average, and
 * `load1` preserves the burstiness signal.
 *
 * Gating mirrors the other crons: dormant in dev/build, IS_STANDBY-gated
 * (primary container only — the standby sampling too would double every point),
 * singleton via globalThis.
 */

const CPU_TRACKER = 'host-stats-cron'

/** One sample: read the host and write the `host_stats` event. Exported for tests. */
export function sample_host_stats_once({ log = log_server_event }: { log?: typeof log_server_event } = {}): void {
  try {
    const stats = read_host_stats({ tracker: CPU_TRACKER })
    log({ level: 'info', message: 'host_stats', context: { ...stats } })
  } catch (err) {
    console.error('[host-stats] sample failed:', err)
  }
}

/**
 * The roster's `on_start`: prime the CPU baseline at schedule time so the first
 * logged event carries a real full-window average instead of a null.
 */
export function prime_host_stats_baseline(): void {
  read_host_stats({ tracker: CPU_TRACKER })
}
