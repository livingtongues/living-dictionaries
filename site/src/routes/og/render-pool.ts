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

interface PendingJob {
  resolve: (png: Uint8Array) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export function create_render_pool({ source, worker_data, render_timeout_ms = 20_000, idle_shutdown_ms = 10 * 60_000, on_event }: {
  /** The worker's JavaScript SOURCE (see `render-worker.js` for why it's a string). */
  source: string
  worker_data: Record<string, unknown>
  /**
   * A render that hasn't answered by now is assumed wedged: the caller gets an
   * error and the worker is destroyed, because whatever it is doing it is doing
   * with a core. Generous next to a ~800 ms render — this is a deadlock catcher,
   * not a latency budget (the route's queue owns latency).
   */
  render_timeout_ms?: number
  /** Reclaim the worker's ~100 MB when no card has been rendered for this long. */
  idle_shutdown_ms?: number
  on_event?: (event: PoolEvent) => void
}): RenderPool {
  let worker: Worker | null = null
  let spawns = 0
  let next_id = 1
  const in_flight = new Map<number, PendingJob>()
  let idle_timer: ReturnType<typeof setTimeout> | null = null

  function notify(event: PoolEvent) {
    try {
      on_event?.(event)
    } catch {
      // telemetry must never be the thing that breaks a render
    }
  }

  function settle_all(error: Error) {
    for (const [id, job] of in_flight) {
      clearTimeout(job.timer)
      in_flight.delete(id)
      job.reject(error)
    }
  }

  /** Drop the current worker. In-flight jobs are rejected — they can't be answered. */
  function destroy(reason: string, error?: Error) {
    const dying = worker
    worker = null
    if (idle_timer) {
      clearTimeout(idle_timer)
      idle_timer = null
    }
    settle_all(error ?? new Error(`og render worker ${reason}`))
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
    const job = in_flight.get(message?.id)
    if (!job)
      return // a late answer from a job we already timed out
    clearTimeout(job.timer)
    in_flight.delete(message.id)
    if (message.type === 'done')
      job.resolve(message.png)
    else
      job.reject(to_error(message))
    settle_idle()
  }

  /**
   * A worker with nothing in flight must not hold the process open (or a vitest
   * run), and after a quiet stretch it shouldn't hold its memory either.
   */
  function settle_idle() {
    if (in_flight.size > 0 || !worker)
      return
    worker.unref()
    if (idle_timer)
      clearTimeout(idle_timer)
    idle_timer = setTimeout(() => {
      if (in_flight.size === 0 && worker) {
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

  return {
    render(job) {
      return new Promise<Uint8Array>((resolve, reject) => {
        let active: Worker
        try {
          active = ensure_worker()
        } catch (error) {
          // Nothing to fall back to on purpose: rendering in-process is the exact
          // thing this file exists to prevent. The route serves its generic card.
          const failure = error instanceof Error ? error : new Error(`og render worker could not start: ${error}`)
          notify({ message: 'og_render_worker_unavailable', error: failure })
          reject(failure)
          return
        }
        if (idle_timer) {
          clearTimeout(idle_timer)
          idle_timer = null
        }
        active.ref()

        const id = next_id++
        const timer = setTimeout(() => {
          in_flight.delete(id)
          reject(new Error(`og render timed out after ${render_timeout_ms}ms`))
          // The worker is holding a core doing something we no longer want.
          if (worker === active)
            destroy('timed out')
          notify({ message: 'og_render_worker_timeout', context: { render_timeout_ms, width: job.width, height: job.height } })
        }, render_timeout_ms)
        in_flight.set(id, { resolve, reject, timer })
        active.postMessage({ id, ...job })
      })
    },
    stats: () => ({ spawns, in_flight: in_flight.size, alive: !!worker }),
    shutdown: () => destroy('shut down'),
  }
}

function to_error(message: { message?: string, stack?: string | null }): Error {
  const error = new Error(message?.message || 'og render worker failed')
  if (message?.stack)
    error.stack = message.stack
  return error
}
