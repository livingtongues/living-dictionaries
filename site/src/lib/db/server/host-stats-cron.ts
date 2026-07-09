import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
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

const SAMPLE_INTERVAL_MS = 5 * 60 * 1000
const CPU_TRACKER = 'host-stats-cron'

const SINGLETON_KEY = Symbol.for('living.host-stats-cron.state')
interface CronState { interval: ReturnType<typeof setInterval> }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

/** One sample: read the host and write the `host_stats` event. Exported for tests. */
export function sample_host_stats_once({ log = log_server_event }: { log?: typeof log_server_event } = {}): void {
  try {
    const stats = read_host_stats({ tracker: CPU_TRACKER })
    log({ level: 'info', message: 'host_stats', context: { ...stats } })
  } catch (err) {
    console.error('[host-stats] sample failed:', err)
  }
}

export function start_host_stats_cron_once(): void {
  if (building || dev)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[host-stats] IS_STANDBY — cron disabled on standby container.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY]) {
    console.info('[host-stats] Already running — skip.')
    return
  }
  // Prime the CPU baseline now so the first logged event (in 5 min) carries a
  // real full-window average instead of a null.
  read_host_stats({ tracker: CPU_TRACKER })
  slot[SINGLETON_KEY] = {
    // .unref(): background telemetry must never keep Node alive on its own.
    interval: setInterval(() => sample_host_stats_once(), SAMPLE_INTERVAL_MS).unref(),
  }
  console.info(`[host-stats] Started — logging a host_stats event every ${SAMPLE_INTERVAL_MS / 60_000} min.`)
}

export function stop_host_stats_cron(): void {
  const slot = globalThis as unknown as GlobalWithCron
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}
