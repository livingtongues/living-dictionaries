import { Worker } from 'node:worker_threads'

/**
 * Owns the ONE worker thread that rasterizes share cards, and makes its failure
 * modes boring: a render that hangs, a worker that dies mid-job, and a worker
 * that can't be spawned at all must each settle the caller's promise quickly and
 * leave the pool usable — never wedge the endpoint, and never take a request
 * thread down with them.
 *
 * WHY A WORKER AT ALL: see the header of `render-worker.js`. satori + resvg are
 * synchronous, so an in-process render is ~800 ms during which the event loop is
 * unreachable and `/healthz` cannot be answered. Off-thread, a health check can
 * never queue behind a card.
 *
 * ONE worker, deliberately: the box has 2 cores, and a second renderer would buy
 * throughput on an endpoint nothing waits on while taking the core the request
 * thread needs. The `/og` route's render queue is what bounds the backlog.
 */

export interface RenderJob {
  markup: string
  height: number
  width: number
}

/** Non-fatal notes from inside the worker (a font retry, a dead font CDN). */
export interface PoolEvent {
  message: string
  error?: Error
  context?: Record<string, unknown>
}

export interface RenderPool {
  render: (job: RenderJob) => Promise<Uint8Array>
  stats: () => { spawns: number, in_flight: number, alive: boolean }
  /** Tests + graceful shutdown. In-flight jobs reject. */
  shutdown: () => void
}

interface QueuedJob {
  job: RenderJob
  resolve: (bytes: Uint8Array) => void
  reject: (error: Error) => void
}

interface ActiveJob {
  id: number
  resolve: (bytes: Uint8Array) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * How long ONE dispatched render may go unanswered before the worker is presumed
 * dead.
 *
 * WAS 20 s, AND THE 20 s WAS MEASURING THE WRONG THING (ported back from house,
 * 2026-07-30). This pool used to post every job at once and start each job's
 * clock the moment it was posted, so eight concurrent callers all started their
 * 20 s together and the last one was "timed out" by the seven ahead of it — a
 * queue length reported as a wedged renderer, which is exactly the shape of the
 * timeouts production logged.
 *
 * Now one job is dispatched at a time and the clock starts when the worker is
 * HANDED the job, so the number bounds a render and nothing else. That makes a
 * much tighter bound honest: ~12× a normal render, and nobody waits on the
 * result but a link scraper. It answers one question — "is this worker coming
 * back?" — and answering it sooner returns the core sooner.
 */
const RENDER_TIMEOUT_MS = 10_000

export function create_render_pool({ source, worker_data, render_timeout_ms = RENDER_TIMEOUT_MS, idle_shutdown_ms = 10 * 60_000, on_event }: {
  /** The worker's JavaScript SOURCE (see `render-worker.js` for why it's a string). */
  source: string
  worker_data: Record<string, unknown>
  render_timeout_ms?: number
  /** Reclaim the worker's ~100 MB when no card has been rendered for this long. */
  idle_shutdown_ms?: number
  on_event?: (event: PoolEvent) => void
}): RenderPool {
  let worker: Worker | null = null
  let spawns = 0
  let next_id = 1
  /** Jobs handed to the worker: exactly one at a time (see RENDER_TIMEOUT_MS). */
  let active: ActiveJob | null = null
  const waiting: QueuedJob[] = []
  let idle_timer: ReturnType<typeof setTimeout> | null = null

  function notify(event: PoolEvent) {
    try {
      on_event?.(event)
    } catch {
      // telemetry must never be the thing that breaks a render
    }
  }

  /** Drop the current worker. Everything outstanding is rejected — it can't be answered. */
  function destroy(reason: string, error?: Error) {
    const dying = worker
    worker = null
    if (idle_timer) {
      clearTimeout(idle_timer)
      idle_timer = null
    }
    const failure = error ?? new Error(`og render worker ${reason}`)
    const dead = active
    active = null
    if (dead) {
      clearTimeout(dead.timer)
      dead.reject(failure)
    }
    // The queue behind it dies with it rather than being replayed against a
    // fresh worker: every caller here degrades to a stored card in milliseconds,
    // and a retry storm behind a renderer that just died is the wrong instinct.
    while (waiting.length)
      waiting.shift()?.reject(failure)
    if (dying) {
      // `terminate()` on an already-exited worker resolves harmlessly.
      void dying.terminate().catch(() => null)
    }
  }

  function handle_message(message: any) {
    if (message?.type === 'warn') {
      notify({ message: 'og_render_failed', error: to_error(message), context: { reason_source: 'worker', ...message.context } })
      return
    }
    if (!active || active.id !== message?.id)
      return // a late answer from a job we already timed out
    const finished = active
    active = null
    clearTimeout(finished.timer)
    if (message.type === 'done')
      finished.resolve(message.png)
    else
      finished.reject(to_error(message))
    pump()
  }

  /**
   * A worker with nothing outstanding must not hold the process open (or a
   * vitest run), and after a quiet stretch it shouldn't hold its memory either.
   */
  function settle_idle() {
    if (active || waiting.length || !worker)
      return
    worker.unref()
    if (idle_timer)
      clearTimeout(idle_timer)
    idle_timer = setTimeout(() => {
      if (!active && !waiting.length && worker) {
        const dying = worker
        worker = null
        void dying.terminate().catch(() => null)
      }
    }, idle_shutdown_ms)
    idle_timer.unref?.()
  }

  function ensure_worker(): Worker {
    if (worker)
      return worker
    const spawned = new Worker(source, { eval: true, workerData: worker_data })
    spawns++
    spawned.on('message', handle_message)
    // An uncaught throw inside the worker (a bad `postMessage`, an OOM) arrives
    // here; the worker is already gone by the time `exit` follows.
    spawned.on('error', (error) => {
      if (worker === spawned)
        destroy('errored', error)
      notify({ message: 'og_render_worker_died', error, context: { spawns } })
    })
    spawned.on('exit', (code) => {
      if (worker !== spawned)
        return // our own terminate(), or an idle shutdown
      destroy(`exited with code ${code}`)
      notify({ message: 'og_render_worker_died', context: { exit_code: code, spawns } })
    })
    worker = spawned
    return spawned
  }

  /** Hand the worker the next job, if it is free and there is one. */
  function pump() {
    if (active) {
      return
    }
    const next = waiting.shift()
    if (!next) {
      settle_idle()
      return
    }

    let running: Worker
    try {
      running = ensure_worker()
    } catch (error) {
      // Nothing to fall back to on purpose: rendering in-process is the exact
      // thing this file exists to prevent. The route serves its generic card.
      const failure = error instanceof Error ? error : new Error(`og render worker could not start: ${error}`)
      notify({ message: 'og_render_worker_unavailable', error: failure })
      next.reject(failure)
      pump()
      return
    }

    if (idle_timer) {
      clearTimeout(idle_timer)
      idle_timer = null
    }
    running.ref()

    const id = next_id++
    const timer = setTimeout(() => {
      // The clock started when the worker RECEIVED this job, so it really is
      // "one render is not coming back" and not "the queue is long".
      if (worker === running)
        destroy('timed out', new Error(`og render timed out after ${render_timeout_ms}ms`))
      notify({ message: 'og_render_worker_timeout', context: { render_timeout_ms, width: next.job.width, height: next.job.height } })
    }, render_timeout_ms)
    active = { id, resolve: next.resolve, reject: next.reject, timer }
    running.postMessage({ id, ...next.job })
  }

  return {
    render(job) {
      return new Promise<Uint8Array>((resolve, reject) => {
        waiting.push({ job, resolve, reject })
        pump()
      })
    },
    stats: () => ({ spawns, in_flight: (active ? 1 : 0) + waiting.length, alive: !!worker }),
    shutdown: () => destroy('shut down'),
  }
}

function to_error(message: { message?: string, stack?: string | null }): Error {
  const error = new Error(message?.message || 'og render worker failed')
  if (message?.stack)
    error.stack = message.stack
  return error
}
