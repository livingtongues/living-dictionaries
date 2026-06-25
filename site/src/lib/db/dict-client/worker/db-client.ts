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

  transport.on_ready((meta) => { last_meta = meta as LeaderMeta })

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
    worker = new Worker(new URL('./leader-worker.ts', import.meta.url), {
      type: 'module',
      name: `ld-db-leader-${dict_id}`,
    })
    const init: WorkerInitMessage = { channel_name, instance_options }
    worker.postMessage(init)
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
      election.resign()
      transport.destroy()
      worker?.terminate()
      worker = null
    },
  }
}
