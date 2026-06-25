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
import type { DbEvent, DbRequest, InstanceOptions, LeaderMeta, WorkerInitMessage } from './instance'
import { db_channel_name, db_lock_name } from './instance'
import { start_leader_election } from './leader-election'
import type { LeaderElection } from './leader-election'
import type { BootFault } from './boot-recovery'
import { boot_retry_decision, read_boot_fault } from './boot-recovery'
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

export function create_db_client({ instance_options }: { instance_options: InstanceOptions }): DbClient {
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
  // Synthetic wedge-harness fault (inert in prod — the window flag is never set).
  const boot_fault: BootFault | undefined = read_boot_fault()
  let fault_remaining = boot_fault?.count ?? 0

  transport.on_ready((meta) => { last_meta = meta as LeaderMeta; boot_attempt = 0 })

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
    spawned.onmessage = (event: MessageEvent<{ type?: string, message?: string }>) => {
      if (event.data?.type !== 'boot_failed')
        return
      spawned.terminate()
      if (worker === spawned) worker = null
      const { will_retry, delay_ms } = boot_retry_decision({ attempt: boot_attempt })
      if (will_retry) {
        console.warn(`[db-client] leader worker boot failed (attempt ${boot_attempt + 1}) — retrying in ${delay_ms}ms:`, event.data.message)
        boot_attempt++
        boot_retry_timer = setTimeout(() => { boot_retry_timer = null; spawn_leader_worker() }, delay_ms)
      } else {
        console.warn('[db-client] leader worker boot failed — retries exhausted, resigning leadership:', event.data.message)
        boot_attempt = 0
        election.resign()
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
      election.resign()
      transport.destroy()
      worker?.terminate()
      worker = null
    },
  }
}
