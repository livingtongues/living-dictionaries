import type { MediaSweepSummary, SummaryMessage } from './media-sweep-child'
import { fork } from 'node:child_process'
import process from 'node:process'
import { setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { building, dev } from '$app/environment'
import { log_server_event } from '$lib/server/log-server-event'
import { r2_media_is_configured } from '$lib/server/r2-media'

/**
 * THE media storage sweep, PARENT SIDE. The job itself lives in
 * `media-sweep-child.ts` (dynamically imported, so it lands in its own bundle
 * chunk — see the header there for why that matters).
 *
 * WHY IT MOVED OUT OF THE WEB PROCESS (2026-08-07): on 2026-08-06 the weekly
 * reconcile listed 381,719 R2 objects and diffed them against the ledger IN THE
 * SERVING PROCESS, freezing the event loop for 20,233 ms — the day's second-worst
 * stall — and a user took a 502 in the very same second. better-sqlite3 and the
 * listing loop are both synchronous, so nothing else could be served for twenty
 * seconds. The object count is up 62% in a week, so this got worse every Monday.
 *
 * Standing law: telemetry and background work must never block a request path.
 * Every other long job on this box (log retention, analytics, audio derivatives)
 * had already moved to a `nice 19` child; this was the last one that hadn't.
 */

/** Deadlock catcher. A full listing + heal is minutes, never hours. */
const CHILD_TIMEOUT_MS = 90 * 60_000

/** Parent-side hold above which the fork itself deserves a `warn`. */
const BLOCKING_WARN_MS = 250

const RUNNING_KEY = Symbol.for('living.media-sweep.running')
function running_since(): number | null {
  return (globalThis as Record<symbol, unknown>)[RUNNING_KEY] as number | null ?? null
}
function set_running(value: number | null): void {
  (globalThis as Record<symbol, unknown>)[RUNNING_KEY] = value
}

/** Test-only: drop the in-flight guard (a fake child never fires `exit`). */
export function _reset_media_sweep_running_for_tests(): void {
  set_running(null)
}

/** The roster's `disabled_reason`: dormant without R2 media credentials. */
export function media_sweep_disabled_reason(): string | null {
  return r2_media_is_configured() ? null : 'R2 media creds absent'
}

/**
 * THE cron entry point. Forks the child and returns immediately.
 *
 * `blocking_ms` on the completion event is the number this whole change is
 * judged by: the time the SERVING process' event loop was held — now just the
 * fork call and the logging, instead of a 381,719-object listing.
 */
export async function run_media_sweep({ fork_impl = fork, inline = dev }: {
  fork_impl?: typeof fork
  /** Run in THIS process instead of forking — dev has no bundle to fork; tests set it false. */
  inline?: boolean
} = {}): Promise<'spawned' | 'already-running' | 'ran-inline' | 'failed'> {
  if (building)
    return 'failed'
  const running = running_since()
  if (running) {
    console.info(`[media-sweep] already running (${Math.round((Date.now() - running) / 1000)}s) — skipping.`)
    return 'already-running'
  }
  set_running(Date.now())

  // Dynamic, ALWAYS: this is both how the job stays in its own chunk and how we
  // learn that chunk's path (`MEDIA_SWEEP_MODULE_URL`) without a build-time guess.
  const { run_media_sweep_job, MEDIA_SWEEP_MODULE_URL, CHILD_NICE, CHILD_IONICE_CLASS } = await import('./media-sweep-child')

  if (inline) {
    try {
      const summary = await run_media_sweep_job()
      report_summary({ summary, blocking_ms: summary.duration_ms })
      return 'ran-inline'
    } catch (error) {
      console.error('[media-sweep] inline sweep failed:', error)
      log_server_event({ level: 'error', message: 'media_sweep_failed', error, context: { inline: true } })
      return 'failed'
    } finally {
      set_running(null)
    }
  }

  const spawn_started = performance.now()
  try {
    const child = fork_impl(fileURLToPath(MEDIA_SWEEP_MODULE_URL), [], {
      env: { ...process.env, MEDIA_SWEEP_CHILD: '1' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    // Everything the PARENT does from here on is charged to `blocking_ms`.
    const blocking_ms = performance.now() - spawn_started
    let summary: MediaSweepSummary | null = null
    const timer = setTimeout(() => {
      console.error(`[media-sweep] child ${child.pid} exceeded ${CHILD_TIMEOUT_MS}ms — killing.`)
      child.kill('SIGKILL')
    }, CHILD_TIMEOUT_MS)
    timer.unref()
    let settled = false
    function settle(): boolean {
      if (settled)
        return false
      settled = true
      clearTimeout(timer)
      set_running(null)
      return true
    }
    child.on('message', (raw) => {
      const message = raw as SummaryMessage
      if (message.type === 'summary')
        ({ summary } = message)
    })
    child.on('error', (error) => {
      console.error('[media-sweep] child could not be spawned:', error)
      if (!settle())
        return
      log_server_event({ level: 'error', message: 'media_sweep_failed', context: { spawn_error: error.message } })
    })
    child.on('exit', (code, signal) => {
      if (!settle())
        return
      if (code === 0 && summary) {
        report_summary({ summary, blocking_ms })
        return
      }
      log_server_event({ level: 'error', message: 'media_sweep_failed', context: { code, signal, blocking_ms: Math.round(blocking_ms) } })
    })
    console.info(`[media-sweep] spawned sweep child ${child.pid} at nice ${CHILD_NICE}, ionice class ${CHILD_IONICE_CLASS}.`)
    return 'spawned'
  } catch (error) {
    set_running(null)
    console.error('[media-sweep] spawn failed:', error)
    log_server_event({ level: 'error', message: 'media_sweep_failed', error })
    return 'failed'
  }
}

/**
 * The run's telemetry, emitted by the PARENT because the child has no telemetry
 * handle (it must not open a second logs.db writer).
 *
 * `media_sweep_reconciled` now carries `duration_ms` + `step_ms` + `blocking_ms`,
 * matching `snapshot_sweep_completed`. Before this the summary was nine counters
 * and NO cost at all, so the 20.2 s freeze it caused had to be inferred from a
 * host sample that happened to land in the same five-minute window (§1.6).
 */
function report_summary({ summary, blocking_ms }: { summary: MediaSweepSummary, blocking_ms: number }): void {
  const rounded = Math.round(blocking_ms)

  if (summary.error) {
    log_server_event({ level: 'error', message: 'media_sweep_failed', context: { detail: summary.error, duration_ms: summary.duration_ms, blocking_ms: rounded } })
    return
  }

  // Per-dictionary alarms the child collected on our behalf. Each is a real
  // error: one says a dictionary could not be read, the other that marking was
  // refused because an implausible share of it went unreferenced at once.
  for (const alert of summary.reconcile?.alerts ?? [])
    log_server_event({ level: 'error', message: alert.message, context: alert.context })

  if (summary.reconcile) {
    const { alerts: _alerts, ...counters } = summary.reconcile
    // A run that skipped a dictionary or hit the brake is NOT routine — the
    // summary used to be one `info` row where nine numbers looked alike.
    log_server_event({
      level: counters.dicts_unreadable || counters.dicts_braked || rounded > BLOCKING_WARN_MS ? 'warn' : 'info',
      message: 'media_sweep_reconciled',
      context: { ...counters, blocking_ms: rounded },
    })
    console.info(`[media-sweep] reconciled ${counters.listed} objects in ${counters.duration_ms}ms (list ${counters.step_ms.list}ms, ledger_diff ${counters.step_ms.ledger_diff}ms, heal ${counters.step_ms.heal}ms; parent blocked ${rounded}ms).`)
  }

  if (summary.probe && summary.probe.probed > 0)
    log_server_event({ level: 'info', message: 'media_metadata_probed', context: { ...summary.probe } })
}
