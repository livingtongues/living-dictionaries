import type { AudioDerivativeSummary, ChildMessage } from './audio-derivative-backfill'
import { fork } from 'node:child_process'
import process from 'node:process'
import { setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { building, dev } from '$app/environment'
import { log_server_event } from '$lib/server/log-server-event'
import { record_media_object_by_key } from './media-ledger'

/**
 * THE audio playback-derivative backfill, PARENT SIDE — a once-daily catch-up
 * that runs in a `nice 19` child process. The job itself lives in
 * `audio-derivative-backfill.ts` (dynamically imported, so it lands in its own
 * bundle chunk — see the header there for why that matters).
 *
 * Conversion on UPLOAD is the real path (`/api/audio/generate-derivative`, fired
 * by the browser the moment a clip lands, and by the aligner). This job exists
 * only to catch what that path missed: a failed conversion, a clip uploaded
 * while the box was down, or a timing-sensitive clip whose derivative went stale
 * when its sentence/text/timings changed.
 *
 * WHY IT MOVED OUT OF THE WEB PROCESS (2026-08-04, Jacob's ruling):
 * it shipped on 2026-08-03 as a FIVE-MINUTE cron running synchronously in the
 * serving process, and the typical five-minute *worst* event-loop stall went
 * 65 ms → 623 ms for the whole day, with 27% of samples over 800 ms (before:
 * 2%). Two causes, both structural rather than accidental:
 *   1. a `LEFT JOIN` over the 155k-row media ledger whose join key was a
 *      COMPUTED string (`substr(...) || '_p1.mp3'`) — no index can serve that,
 *      so it was a full scan every five minutes;
 *   2. up to 160 synchronous `new Database(...)` opens per run, one per
 *      candidate row, on the thread that answers requests.
 * Both are fine in a child at nice 19; neither is survivable on a request
 * thread. The standing law is "telemetry and background work must never block a
 * request path", and a backfill is the most background thing on the machine.
 */

/** Deadlock catcher, comfortably past the job's own `MAX_RUN_MS` budget. */
const CHILD_TIMEOUT_MS = 90 * 60_000

const RUNNING_KEY = Symbol.for('living.audio-derivative-sweep.running')
function running_since(): number | null {
  return (globalThis as Record<symbol, unknown>)[RUNNING_KEY] as number | null ?? null
}
function set_running(value: number | null): void {
  (globalThis as Record<symbol, unknown>)[RUNNING_KEY] = value
}

/** Test-only: drop the in-flight guard (a fake child never fires `exit`). */
export function _reset_audio_derivative_running_for_tests(): void {
  set_running(null)
}

/**
 * THE cron entry point. Forks the child and returns immediately.
 *
 * `blocking_ms` on the completion event is the honest number this whole change
 * is judged by: the time the SERVING process' event loop was held by this job —
 * the fork call plus one small indexed ledger INSERT per generated derivative.
 * It is what §1.2 of the 2026-08-03 log review needed and did not have.
 */
export async function run_audio_derivative_sweep({ fork_impl = fork, inline = dev }: {
  fork_impl?: typeof fork
  /** Run in THIS process instead of forking — dev has no bundle to fork; tests set it false. */
  inline?: boolean
} = {}): Promise<'spawned' | 'already-running' | 'ran-inline' | 'failed'> {
  if (building)
    return 'failed'
  const running = running_since()
  if (running) {
    console.info(`[audio-derivative] backfill already running (${Math.round((Date.now() - running) / 1000)}s) — skipping.`)
    return 'already-running'
  }
  set_running(Date.now())

  // Dynamic, ALWAYS: this is both how the job stays in its own chunk and how we
  // learn that chunk's path (`BACKFILL_MODULE_URL`) without a build-time guess.
  const { run_audio_derivative_backfill, BACKFILL_MODULE_URL, CHILD_NICE, CHILD_IONICE_CLASS } = await import('./audio-derivative-backfill')

  if (inline) {
    try {
      const summary = await run_audio_derivative_backfill({
        report: message => record_media_object_by_key({ key: message.key, bytes: message.bytes, duration_ms: message.duration_ms }),
      })
      report_summary({ summary, blocking_ms: summary.duration_ms })
      return 'ran-inline'
    } catch (error) {
      console.error('[audio-derivative] inline backfill failed:', error)
      log_server_event({ level: 'error', message: 'audio_derivative_sweep_failed', error, context: { inline: true } })
      return 'failed'
    } finally {
      set_running(null)
    }
  }

  const spawn_started = performance.now()
  try {
    const child = fork_impl(fileURLToPath(BACKFILL_MODULE_URL), [], {
      env: { ...process.env, AUDIO_DERIVATIVE_CHILD: '1' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    // Everything the PARENT does from here on is charged to `blocking_ms`.
    let blocking_ms = performance.now() - spawn_started
    let summary: AudioDerivativeSummary | null = null
    const timer = setTimeout(() => {
      console.error(`[audio-derivative] child ${child.pid} exceeded ${CHILD_TIMEOUT_MS}ms — killing.`)
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
      const message = raw as ChildMessage
      if (message.type === 'summary') {
        ({ summary } = message)
        return
      }
      // The child is read-only by design, so the ledger row lands here. One
      // indexed upsert; a lost row is re-derived by the weekly media reconcile.
      const started = performance.now()
      try {
        record_media_object_by_key({ key: message.key, bytes: message.bytes, duration_ms: message.duration_ms })
      } catch (error) {
        console.error(`[audio-derivative] ledger write failed for ${message.key}:`, error)
      }
      blocking_ms += performance.now() - started
    })
    child.on('error', (error) => {
      console.error('[audio-derivative] child could not be spawned:', error)
      if (!settle())
        return
      log_server_event({ level: 'error', message: 'audio_derivative_sweep_failed', context: { spawn_error: error.message } })
    })
    child.on('exit', (code, signal) => {
      if (!settle())
        return
      if (code === 0 && summary) {
        report_summary({ summary, blocking_ms })
        return
      }
      log_server_event({ level: 'error', message: 'audio_derivative_sweep_failed', context: { code, signal, blocking_ms: Math.round(blocking_ms), ...(summary ?? {}) } })
    })
    console.info(`[audio-derivative] spawned backfill child ${child.pid} at nice ${CHILD_NICE}, ionice class ${CHILD_IONICE_CLASS}.`)
    return 'spawned'
  } catch (error) {
    set_running(null)
    console.error('[audio-derivative] spawn failed:', error)
    log_server_event({ level: 'error', message: 'audio_derivative_sweep_failed', error })
    return 'failed'
  }
}

/**
 * One row per run. `warn` when the parent was held for more than a request's
 * worth of time, or when clips failed to convert — a clip that never converts is
 * silently stuck on the un-normalized original forever, and before this event
 * that fact existed only in a `console.error` the next deploy threw away.
 */
function report_summary({ summary, blocking_ms }: { summary: AudioDerivativeSummary, blocking_ms: number }): void {
  const rounded = Math.round(blocking_ms)
  log_server_event({
    level: rounded > 250 || summary.failed > 0 ? 'warn' : 'info',
    message: 'audio_derivative_sweep_completed',
    context: { ...summary, blocking_ms: rounded },
  })
  console.info(`[audio-derivative] backfill: ${summary.generated} generated, ${summary.failed} failed, ${summary.candidates} candidates of ${summary.scanned} scanned in ${summary.duration_ms}ms (parent blocked ${rounded}ms).`)
}
