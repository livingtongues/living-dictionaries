import type Database from 'better-sqlite3'
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db } from './shared-db'

/**
 * Wall-clock cron scheduler — cadence is INDEPENDENT of deploy frequency.
 *
 * The old pattern (a bare `setInterval` per cron + "run once at boot" so long
 * intervals survived rapid-deploy days) coupled maintenance cadence to how
 * often we deploy: 15 deploys in 30 min meant 15 boot bursts, each landing in
 * the exact blue/green warmup window where the standby is the sole backend —
 * the CPU spike behind the Living 503 (2026-07-29, vps-setup
 * `.issues/cron-boot-stagger-and-horse-cron-visibility.md`).
 *
 * This scheduler persists each cron's `last_run_at` in `cron_runs`
 * (shared.db) and schedules the next run at `last_run + interval`:
 *   - Deploy 15× in 30 min → maintenance runs exactly as often as if you
 *     hadn't deployed at all (nothing is due right after a boot).
 *   - 4 quiet days → intervals tick normally.
 *   - Genuinely OVERDUE work (box was down past a due time) still runs, but
 *     never before a post-boot QUIET period (past the blue/green warmup) and
 *     multiple overdue crons are spaced out, never fired together.
 *
 * Short-cadence queue drainers (interval < PERSIST_THRESHOLD_MS: outbox
 * sweeps, send ticks) skip persistence — a row per 20s tick buys nothing —
 * and just take their natural first tick at `interval` after boot, exactly
 * like the old `setInterval` behavior. Their work is a cheap indexed query.
 *
 * The scheduler owns ALL the per-cron boilerplate the cron files used to
 * copy: dev/build gate, IS_STANDBY gate (blue/green: the primary is the sole
 * cron node), globalThis singleton (Vite HMR / repeated imports), in-flight
 * guard, `.unref()`ed timers (never hold Node open), and error capture into
 * `client_logs` (`cron_run_failed` + `context.cron`) so the log review sees
 * background-job health instead of only ephemeral docker logs.
 *
 * The roster lives in `crons.ts` as plain data — that file is the single
 * source of truth for WHAT runs and HOW OFTEN (and is read statically by
 * horse's fleet-crons view on mustang).
 */

export interface CronDef {
  /** Stable id — the `cron_runs` primary key. Renaming = one overdue run. */
  name: string
  /** One line, human-readable: crons.ts doubles as the machine's cron documentation. */
  description: string
  /** Wall-clock cadence in ms (use the seconds/minutes/hours/days helpers in crons.ts). */
  every_ms: number
  /**
   * Pin a DAILY cron to a wall-clock LOCAL time instead of "every_ms after the
   * last run". Only valid with `every_ms: days(1)`.
   *
   * WHY: jobs that must happen at a human hour (the 8am digest) used to be
   * declared hourly and then no-op 23 times a day, checking "is it 8am in
   * America/Los_Angeles yet?" — 24 wakeups to do one thing. A bare `days(1)`
   * can't replace that: it drifts to whatever time the cron first ran, so a
   * job whose body still guards on "at/after 8am PT" would fire at 6am,
   * skip, and never send again.
   *
   * DST: the delay is computed as "seconds until that tz's wall clock next
   * reads HH:MM", re-derived after every run, so it tracks DST automatically.
   * Only the transition day itself can land ±1h off; it self-corrects the
   * next day, which is well inside what a daily digest cares about.
   */
  at?: { hour: number, minute: number, tz: string }
  /**
   * One run. May throw — the scheduler catches, logs a `cron_run_failed`
   * server event, and keeps the cadence. Files with a domain-specific failure
   * event (e.g. `log_retention_sweep_failed`) keep their own try/catch too.
   */
  run: () => void | Promise<void>
  /**
   * Extra gate beyond dev/build + IS_STANDBY (env flags, credentials).
   * Return a human-readable reason to SKIP scheduling, or null to run.
   * Evaluated once at boot — mirrors the old per-cron start guards.
   */
  disabled_reason?: () => string | null
  /** One-time setup at schedule time (CPU-baseline priming, activation-floor stamping). */
  on_start?: () => void
  /** Also tick during `pnpm dev` (default: prod-only, like the old dev/build guards). */
  run_in_dev?: boolean
}

/** Don't run anything heavy before this long after boot — covers the blue/green warmup window. */
export const QUIET_AFTER_BOOT_MS = 150_000
/** Multiple overdue crons fire this far apart, never together. */
export const OVERDUE_SPACING_MS = 20_000
/** Crons at or above this cadence get persisted wall-clock scheduling; below = plain ticks. */
export const PERSIST_THRESHOLD_MS = 5 * 60_000

/**
 * Epoch ms of the next moment `tz`'s wall clock reads `hour:minute`.
 *
 * Deliberately computed as a DELTA from the current local time-of-day rather
 * than by constructing a date in the target zone: `Intl` can tell us what time
 * it is somewhere, but building "8am tomorrow in Los Angeles" as an epoch means
 * hand-rolling offset math that breaks twice a year. Asking "how many seconds
 * until that clock reads 08:00" is the same answer with none of the arithmetic.
 */
export function next_daily_at(now_ms: number, at: { hour: number, minute: number, tz: string }): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: at.tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(now_ms))
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0')
  // `hour12: false` renders midnight as "24" in some ICU versions — normalize.
  const local_seconds = (part('hour') % 24) * 3600 + part('minute') * 60 + part('second')
  const target_seconds = at.hour * 3600 + at.minute * 60
  const delta = target_seconds - local_seconds
  return now_ms + (delta > 0 ? delta : delta + 86_400) * 1000
}

interface CronRuntime {
  def: CronDef
  timer: ReturnType<typeof setTimeout> | null
  in_flight: boolean
  last_run_at: number | null
  next_run_at: number | null
}

interface SchedulerState { runtimes: Map<string, CronRuntime> }

const SINGLETON_KEY = Symbol.for('living-dictionaries.cron-scheduler.state')
interface GlobalWithScheduler { [SINGLETON_KEY]?: SchedulerState }

interface StartOptions {
  defs: CronDef[]
  /** Injectable for tests; defaults to the app's shared.db. */
  db?: Database.Database
  now?: () => number
}

export function start_crons_once({ defs, db, now = Date.now }: StartOptions): void {
  if (building)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[crons] IS_STANDBY — all crons disabled on the standby container (the primary is the sole cron node).')
    return
  }
  const slot = globalThis as unknown as GlobalWithScheduler
  if (slot[SINGLETON_KEY]) {
    console.info('[crons] Scheduler already running — skip.')
    return
  }
  const state: SchedulerState = { runtimes: new Map() }
  slot[SINGLETON_KEY] = state

  const shared_db = db ?? get_shared_db()
  const persisted = read_last_runs(shared_db)
  const boot = now()
  let overdue_index = 0

  for (const def of defs) {
    if (dev && !def.run_in_dev)
      continue
    const reason = def.disabled_reason?.() ?? null
    if (reason !== null) {
      console.info(`[crons] '${def.name}' disabled — ${reason}`)
      continue
    }
    try {
      def.on_start?.()
    } catch (err) {
      console.error(`[crons] '${def.name}' on_start failed:`, err)
    }

    const runtime: CronRuntime = { def, timer: null, in_flight: false, last_run_at: persisted.get(def.name) ?? null, next_run_at: null }
    state.runtimes.set(def.name, runtime)

    let run_at: number
    if (def.every_ms < PERSIST_THRESHOLD_MS) {
      // Cheap tick-style cron: natural first tick, no persistence, no quiet gate.
      run_at = boot + def.every_ms
    } else if (def.at) {
      // Clock-pinned: always the next time that clock strikes — deliberately NO
      // overdue ladder. A missed 8am digest must not fire at 3pm the moment the
      // box comes back; "at 8am" is the whole contract. (Still floored past the
      // warmup window for the pathological case of booting seconds before it.)
      run_at = Math.max(next_daily_at(boot, def.at), boot + QUIET_AFTER_BOOT_MS)
    } else {
      const due_at = runtime.last_run_at === null ? boot : runtime.last_run_at + def.every_ms
      const quiet_floor = boot + QUIET_AFTER_BOOT_MS
      if (due_at <= quiet_floor) {
        // Due (or overdue / first-ever) at boot — defer past the warmup window,
        // and space stacked overdue runs so they can't burst together.
        run_at = quiet_floor + overdue_index * OVERDUE_SPACING_MS
        overdue_index += 1
      } else {
        run_at = due_at
      }
    }
    schedule(runtime, run_at, shared_db, now)
    const cadence = def.at
      ? `daily at ${String(def.at.hour).padStart(2, '0')}:${String(def.at.minute).padStart(2, '0')} ${def.at.tz}`
      : `every ${format_ms(def.every_ms)}`
    console.info(`[crons] '${def.name}' ${cadence}, next in ${format_ms(run_at - boot)}${runtime.last_run_at === null ? ' (first-ever run)' : ''}.`)
  }
}

function schedule(runtime: CronRuntime, run_at: number, db: Database.Database, now: () => number): void {
  runtime.next_run_at = run_at
  const delay = Math.max(0, run_at - now())
  // .unref(): a background timer must never be the sole reason Node stays
  // alive (lets one-shot importers — svelte-look SSR loading hooks — exit).
  runtime.timer = setTimeout(() => { void execute(runtime, db, now) }, delay).unref()
}

async function execute(runtime: CronRuntime, db: Database.Database, now: () => number): Promise<void> {
  const { def } = runtime
  if (runtime.in_flight)
    return
  runtime.in_flight = true
  const started = now()
  try {
    await def.run()
  } catch (err) {
    console.error(`[crons] '${def.name}' run failed:`, err)
    log_server_event({ level: 'error', message: 'cron_run_failed', error: err, context: { cron: def.name } })
  } finally {
    runtime.in_flight = false
  }
  runtime.last_run_at = started
  if (def.every_ms >= PERSIST_THRESHOLD_MS)
    persist_last_run(db, def.name, started)
  // Next run keys off this run's START (steady wall-clock phase); if the run
  // overran its own interval, push at least 1s out so we never hot-loop.
  // A clock-pinned cron re-derives from the CURRENT time, which is what makes
  // it follow DST without anyone storing an offset.
  const next_at = def.at ? next_daily_at(now(), def.at) : started + def.every_ms
  schedule(runtime, Math.max(next_at, now() + 1000), db, now)
}

function read_last_runs(db: Database.Database): Map<string, number> {
  try {
    const rows = db.prepare('SELECT name, last_run_at FROM cron_runs').all() as { name: string, last_run_at: number }[]
    return new Map(rows.map(row => [row.name, row.last_run_at]))
  } catch (err) {
    // Missing table (pre-migration db) must not stop crons — treat all as first-ever.
    console.error('[crons] reading cron_runs failed — treating all crons as first-ever:', err)
    return new Map()
  }
}

function persist_last_run(db: Database.Database, name: string, last_run_at: number): void {
  try {
    db.prepare('INSERT INTO cron_runs (name, last_run_at) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET last_run_at = excluded.last_run_at')
      .run(name, last_run_at)
  } catch (err) {
    console.error(`[crons] persisting last_run for '${name}' failed:`, err)
  }
}

/** Test/HMR helper: clear all timers + the singleton so a fresh start is possible. */
export function stop_all_crons(): void {
  const slot = globalThis as unknown as GlobalWithScheduler
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  for (const runtime of state.runtimes.values()) {
    if (runtime.timer)
      clearTimeout(runtime.timer)
  }
  delete slot[SINGLETON_KEY]
}

/** Introspection (tests / a future admin panel): the live runtime per cron. */
export function get_cron_runtimes(): { name: string, every_ms: number, last_run_at: number | null, next_run_at: number | null, in_flight: boolean }[] {
  const slot = globalThis as unknown as GlobalWithScheduler
  const state = slot[SINGLETON_KEY]
  if (!state)
    return []
  return [...state.runtimes.values()].map(({ def, last_run_at, next_run_at, in_flight }) =>
    ({ name: def.name, every_ms: def.every_ms, last_run_at, next_run_at, in_flight }))
}

function format_ms(ms: number): string {
  if (ms >= 3_600_000)
    return `${+(ms / 3_600_000).toFixed(1)}h`
  if (ms >= 60_000)
    return `${+(ms / 60_000).toFixed(1)}m`
  return `${+(ms / 1000).toFixed(1)}s`
}
