/**
 * Main-thread client for the leader-worker DB harness. Created in EVERY tab,
 * once per open dictionary.
 *
 * Responsibilities:
 *   1. Run the `navigator.locks` leader election for this dict. The winning tab
 *      spawns the one leader dedicated worker (which owns the dict's OPFS DB +
 *      sync engine).
 *   2. Expose a transport-backed RPC surface (`request`) + event subscription so
 *      this tab — leader or follower — talks to whoever is leader.
 *
 * Followers never spawn a worker; they reach the leader over the BroadcastChannel
 * transport. On a leader hand-off the transport re-sends outstanding requests, so
 * callers don't see the churn. `on_ready` re-fires on every hand-off — editor
 * tabs use it to re-assert `set_role` on a new leader that may have booted
 * viewer-mode (see `dict-lifecycle.ts`).
 */
import type { BootFailure, DbEvent, DbRequest, InstanceOptions, LeaderMeta, WorkerInitMessage } from './instance'
import { db_channel_name, db_lock_name } from './instance'
import { start_leader_election } from './leader-election'
import type { LeaderElection } from './leader-election'
import type { BootFault } from './boot-recovery'
import { boot_retry_decision, read_boot_fault, reelect_delay } from './boot-recovery'
import { ensure_persistent_storage } from './persistent-storage'
import { create_transport_client } from './transport'
import type { TransportClient } from './transport'

export interface DbClient {
  request: <T>(payload: DbRequest, options?: { timeout_ms?: number }) => Promise<T>
  on_event: (handler: (event: DbEvent) => void) => () => void
  /** Fires on every leader `ready` (including hand-offs to a new leader). */
  on_ready: (handler: (meta: LeaderMeta) => void) => () => void
  /** Resolves with leader meta once any tab's leader worker is ready. */
  ready: () => Promise<LeaderMeta>
  /** Last-known leader meta (null before the first `ready`). */
  meta: () => LeaderMeta | null
  destroy: () => void
}

export function create_db_client({ instance_options, on_boot_failed }: {
  instance_options: InstanceOptions
  /**
   * Fired on the main thread every time a spawned leader worker posts
   * `boot_failed` (a throw OR an idle-watchdog stall). The app wires this to
   * telemetry — worker-internal errors never reach `console.error` patching, so
   * this is the ONLY window into boot failures. Kept generic (no app imports).
   */
  on_boot_failed?: (info: BootFailure) => void
}): DbClient {
  const { dict_id } = instance_options
  const channel_name = db_channel_name(dict_id)
  const lock_name = db_lock_name(dict_id)

  const transport: TransportClient = create_transport_client({ channel_name })

  let worker: Worker | null = null
  let last_meta: LeaderMeta | null = null
  // Bounded same-tab boot retry: a transient hang/throw self-heals in THIS tab
  // (so a single tab with no other waiter to promote isn't dead-ended), capped so
  // it can't spin. Reset whenever any leader announces ready.
  let boot_attempt = 0
  let boot_retry_timer: ReturnType<typeof setTimeout> | null = null
  // Slow background re-election after resign (auto-heal a lone dead-ended tab).
  let reelect_attempt = 0
  let reelect_timer: ReturnType<typeof setTimeout> | null = null
  // Synthetic wedge-harness fault (inert in prod — the window flag is never set).
  const boot_fault: BootFault | undefined = read_boot_fault()
  let fault_remaining = boot_fault?.count ?? 0

  transport.on_ready((meta) => {
    // A leader (this tab or another) is healthy — stop retrying + re-electing.
    last_meta = meta as LeaderMeta
    boot_attempt = 0
    reelect_attempt = 0
    if (reelect_timer) { clearTimeout(reelect_timer); reelect_timer = null }
  })

  const election: LeaderElection = start_leader_election({
    lock_name,
    on_promote: () => {
      spawn_leader_worker()
      // Origin-scoped silent request (never prompts viewers). Editors get the
      // prompting request in `dict-lifecycle.ts` once their role is known.
      void ensure_persistent_storage({ allow_prompt: false })
    },
  })

  function spawn_leader_worker(): void {
    if (worker) return
    const spawned = new Worker(new URL('./leader-worker.ts', import.meta.url), {
      type: 'module',
      name: `ld-db-leader-${dict_id}`,
    })
    // The worker posts `boot_failed` if it can't open the DB — a throw OR a
    // watchdog timeout on a HANGING factory (leader-worker.ts). It never announced
    // `ready`, so otherwise every tab's RPCs wedge as "no leader responded". Retry
    // our own boot a few times (covers a transient stall + self-heals a SINGLE tab
    // with no other waiter to promote); once the budget is spent, RESIGN so the
    // browser can promote another tab (or, if none, callers fall back).
    spawned.onmessage = (event: MessageEvent<{ type?: string, message?: string, last_stage?: string }>) => {
      if (event.data?.type !== 'boot_failed')
        return
      spawned.terminate()
      if (worker === spawned) worker = null
      const { will_retry, delay_ms } = boot_retry_decision({ attempt: boot_attempt })
      on_boot_failed?.({
        message: event.data.message ?? 'unknown',
        last_stage: event.data.last_stage,
        attempt: boot_attempt,
        will_retry,
      })
      if (will_retry) {
        console.warn(`[db-client] leader worker boot failed (attempt ${boot_attempt + 1}) — retrying in ${delay_ms}ms:`, event.data.message)
        boot_attempt++
        boot_retry_timer = setTimeout(() => { boot_retry_timer = null; spawn_leader_worker() }, delay_ms)
      } else {
        // Fast in-tab retries spent — resign so ANY other waiter can try, then
        // re-enter the election on a slow backoff. A lone tab (no other waiter)
        // used to dead-end here forever; now it self-heals once the transient
        // cause (deploy window, poor connection) clears. `on_ready` cancels this
        // the moment any tab becomes a healthy leader.
        const reelect_ms = reelect_delay({ attempt: reelect_attempt })
        console.warn(`[db-client] leader worker boot failed — retries exhausted, resigning + re-electing in ${reelect_ms}ms:`, event.data.message)
        boot_attempt = 0
        reelect_attempt++
        election.resign()
        if (reelect_timer) clearTimeout(reelect_timer)
        reelect_timer = setTimeout(() => { reelect_timer = null; election.reacquire() }, reelect_ms)
      }
    }
    worker = spawned
    const init: WorkerInitMessage = { channel_name, instance_options }
    // Inject the synthetic fault for the first N spawns, then let boot succeed.
    if (boot_fault && fault_remaining > 0) {
      init.boot_fault = boot_fault.mode
      init.boot_timeout_ms = boot_fault.timeout_ms
      fault_remaining--
    }
    spawned.postMessage(init)
  }

  return {
    request<T>(payload: DbRequest, options?: { timeout_ms?: number }): Promise<T> {
      return transport.request<T>(payload, options)
    },
    on_event(handler: (event: DbEvent) => void): () => void {
      return transport.on_event(event => handler(event as DbEvent))
    },
    on_ready(handler: (meta: LeaderMeta) => void): () => void {
      return transport.on_ready(meta => handler(meta as LeaderMeta))
    },
    ready(): Promise<LeaderMeta> {
      return transport.ready().then(meta => meta as LeaderMeta)
    },
    meta(): LeaderMeta | null {
      return last_meta
    },
    destroy(): void {
      if (boot_retry_timer) {
        clearTimeout(boot_retry_timer)
        boot_retry_timer = null
      }
      if (reelect_timer) {
        clearTimeout(reelect_timer)
        reelect_timer = null
      }
      election.resign()
      transport.destroy()
      worker?.terminate()
      worker = null
    },
  }
}
