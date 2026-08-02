import type { CronDef } from './cron-scheduler'
import { log_server_event } from '$lib/server/log-server-event'
import { get_cron_runtimes } from './cron-scheduler'
import { CRONS } from './crons'

/**
 * One coalesced daily liveness row per cron.
 *
 * WHY: most of the seven crons emit ONLY failure events, so a cron that
 * quietly stopped ticking and a night with nothing to do produced exactly the
 * same telemetry — nothing. The nightly log review had no way to tell them
 * apart, and "no news" was being read as good news for jobs that send mail and
 * rebuild snapshots. This is the positive signal: once a day, every cron on the
 * roster says whether it is alive and when it last ran.
 *
 * COALESCED on purpose. `host-stats` ticks 288×/day and `wal-checkpoint`
 * 96×; a row per tick would add ~400 rows/day to a large `logs.db` to answer a
 * question that needs one row.
 *
 * WHY IT READS `last_run_at` RATHER THAN COUNTING TICKS: `cron-scheduler.ts` is
 * a CANONICAL file shared byte-for-byte with house and tutor (house owns it, and
 * its `cron-scheduler.parity.test.ts` enforces it), so per-run bookkeeping cannot
 * be added there without a three-repo change. It turns out not to be a loss —
 * `last_run_at` is PERSISTED in `cron_runs` for every cron at or above the
 * 5-minute threshold, so unlike in-memory counters it survives the container
 * restart that a deploy causes, which is exactly when a counter would be least
 * trustworthy. Failures keep their own `cron_run_failed` rows.
 *
 * Reports on the ROSTER, not just on what the scheduler took: a cron whose
 * `disabled_reason` fired is invisible in the runtimes and today says so only
 * to a console nobody reads. Here it gets a row naming the reason.
 */

/** Silence this many times a cron's own cadence is the alarm — not one missed tick. */
export const STALE_CADENCE_MULTIPLE = 2

export interface CronHeartbeatRow {
  level: 'info' | 'warn'
  context: Record<string, unknown>
}

/**
 * One row per roster entry. Pure: everything it needs is passed in, so the
 * decision table is testable without a scheduler, a clock or a database.
 */
export function build_cron_heartbeats({ roster, runtimes, now, uptime_ms }: {
  roster: CronDef[]
  runtimes: { name: string, every_ms: number, last_run_at: number | null, next_run_at: number | null, in_flight: boolean }[]
  now: number
  /** How long this process has been up — the window a never-yet-run cron is judged against. */
  uptime_ms: number
}): CronHeartbeatRow[] {
  const by_name = new Map(runtimes.map(runtime => [runtime.name, runtime]))

  return roster.map((def) => {
    const runtime = by_name.get(def.name)

    if (!runtime) {
      // Declared but not scheduled. `info`, not `warn`: this is a deliberate
      // configuration state (missing credentials, a feature flag), and the row
      // carries the reason. Reserving `warn` for things that are actually
      // WRONG is what keeps a nightly warn worth reading.
      return {
        level: 'info' as const,
        context: {
          cron: def.name,
          scheduled: false,
          ran: false,
          disabled_reason: def.disabled_reason?.() ?? 'not scheduled',
          every_ms: def.every_ms,
        },
      }
    }

    const since_last_run_ms = runtime.last_run_at === null ? null : Math.max(0, now - runtime.last_run_at)
    // A cron that has never run is judged against how long we've been up, so a
    // container three minutes old never reports its daily jobs as dead.
    const silent_ms = since_last_run_ms ?? uptime_ms
    const stale = silent_ms > def.every_ms * STALE_CADENCE_MULTIPLE

    return {
      level: stale ? 'warn' as const : 'info' as const,
      context: {
        cron: def.name,
        scheduled: true,
        ran: runtime.last_run_at !== null,
        stale,
        every_ms: def.every_ms,
        since_last_run_ms,
        last_run_at: runtime.last_run_at === null ? null : new Date(runtime.last_run_at).toISOString(),
        next_run_at: runtime.next_run_at === null ? null : new Date(runtime.next_run_at).toISOString(),
        in_flight: runtime.in_flight,
        uptime_ms: Math.round(uptime_ms),
      },
    }
  })
}

/**
 * The cron body. Reports on itself too — a heartbeat that stops arriving is
 * only readable as "dead" if it was arriving in the first place.
 */
export function run_cron_heartbeat_sweep(): void {
  const rows = build_cron_heartbeats({
    roster: CRONS,
    runtimes: get_cron_runtimes(),
    now: Date.now(),
    uptime_ms: process.uptime() * 1000,
  })
  for (const { level, context } of rows)
    log_server_event({ level, message: 'cron_heartbeat', context })
}
