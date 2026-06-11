/**
 * Cross-context transport between every tab's main thread (clients) and the
 * single leader dedicated worker (server), over a `BroadcastChannel`.
 *
 * WHY BroadcastChannel (not per-follower MessageChannel ports): a
 * `BroadcastChannel` cannot transfer a `MessagePort` (it structured-clones; ports
 * are transfer-only), and the only no-broker cross-tab channel that CAN transfer
 * ports is a SharedWorker — which is exactly what we're dropping. So the leader
 * worker and all tabs share one BroadcastChannel. Idle tabs cheap-filter messages
 * by `client_id`. This whole module is the swappable seam: a future SharedWorker
 * port-broker could replace it without touching the DB/instance/RPC logic.
 *
 * Exactly one leader worker responds, so requests need no `to` address — just a
 * `client_id` (which tab asked) + `req_id`. Clients buffer requests until they've
 * seen a `ready` from a leader, and re-send outstanding requests on every `ready`
 * (covers a leader hand-off mid-flight).
 */

interface RequestMessage {
  kind: 'req'
  client_id: string
  req_id: number
  payload: unknown
}

interface ResponseMessage {
  kind: 'res'
  client_id: string
  req_id: number
  ok: boolean
  result?: unknown
  error?: { code: string, message: string }
}

interface EventMessage {
  kind: 'event'
  event: unknown
}

interface ReadyMessage {
  kind: 'ready'
  /** Per-leader-instance id; changes on hand-off so clients re-send. */
  epoch: string
  meta: unknown
}

interface PingMessage {
  kind: 'ping'
}

type ChannelMessage = RequestMessage | ResponseMessage | EventMessage | ReadyMessage | PingMessage

const DEFAULT_TIMEOUT_MS = 20000
const PING_RETRY_MS = 750

// ── client (main thread, every tab) ─────────────────────────────────────────

export interface TransportClient {
  /** RPC to the leader. Buffers until a leader is ready; retries across hand-off. */
  request: <T>(payload: unknown, options?: { timeout_ms?: number }) => Promise<T>
  /** Subscribe to leader broadcasts (tables_changed, sync_status, …). */
  on_event: (handler: (event: unknown) => void) => () => void
  /** Resolves with leader meta once a leader is ready (re-fires on every ready). */
  on_ready: (handler: (meta: unknown) => void) => () => void
  /** Await the first ready + its meta. */
  ready: () => Promise<unknown>
  destroy: () => void
}

export function create_transport_client({ channel_name }: { channel_name: string }): TransportClient {
  const client_id = crypto.randomUUID()
  const channel = new BroadcastChannel(channel_name)
  const pending = new Map<number, {
    resolve: (value: unknown) => void
    reject: (err: Error & { code?: string }) => void
    payload: unknown
    timer: ReturnType<typeof setTimeout>
    timeout_ms: number
  }>()
  const event_handlers = new Set<(event: unknown) => void>()
  const ready_handlers = new Set<(meta: unknown) => void>()
  const ready_waiters: ((meta: unknown) => void)[] = []
  let req_seq = 0
  let leader_epoch: string | null = null
  let ready_meta: unknown = null
  let ping_timer: ReturnType<typeof setInterval> | null = null

  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    const message = event.data
    if (message.kind === 'res') {
      if (message.client_id !== client_id) return
      const entry = pending.get(message.req_id)
      if (!entry) return
      pending.delete(message.req_id)
      clearTimeout(entry.timer)
      if (message.ok) {
        entry.resolve(message.result)
      } else {
        const err = new Error(message.error?.message || 'RPC error') as Error & { code?: string }
        err.code = message.error?.code
        entry.reject(err)
      }
    } else if (message.kind === 'event') {
      for (const handler of event_handlers) {
        try { handler(message.event) } catch (err) { console.error('[transport] event handler threw:', err) }
      }
    } else if (message.kind === 'ready') {
      const is_new = message.epoch !== leader_epoch
      leader_epoch = message.epoch
      ready_meta = message.meta
      stop_pinging()
      if (is_new) {
        // (Re)send every outstanding request to the new leader — covers the
        // initial buffered-before-any-leader flush AND a hand-off mid-flight.
        // ONLY on a new epoch: the leader answers every joining tab's ping with
        // a same-epoch `ready`, and re-posting then would double-execute an
        // in-flight exec on the still-alive leader.
        for (const [req_id, entry] of pending)
          post({ kind: 'req', client_id, req_id, payload: entry.payload })
        for (const handler of ready_handlers) {
          try { handler(message.meta) } catch (err) { console.error('[transport] ready handler threw:', err) }
        }
      }
      while (ready_waiters.length) ready_waiters.shift()?.(message.meta)
    }
  }

  function post(message: ChannelMessage): void {
    try { channel.postMessage(message) } catch { /* channel closing */ }
  }

  function start_pinging(): void {
    if (ping_timer) return
    post({ kind: 'ping' })
    ping_timer = setInterval(() => post({ kind: 'ping' }), PING_RETRY_MS)
  }
  function stop_pinging(): void {
    if (ping_timer) { clearInterval(ping_timer); ping_timer = null }
  }

  // Discover an already-running leader (its initial `ready` predates us).
  start_pinging()

  return {
    request<T>(payload: unknown, options: { timeout_ms?: number } = {}): Promise<T> {
      const req_id = ++req_seq
      const timeout_ms = options.timeout_ms ?? DEFAULT_TIMEOUT_MS
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(req_id)
          const err = new Error('RPC timed out (no leader responded)') as Error & { code?: string }
          err.code = 'timeout'
          reject(err)
        }, timeout_ms)
        pending.set(req_id, { resolve: resolve as (v: unknown) => void, reject, payload, timer, timeout_ms })
        if (leader_epoch !== null)
          post({ kind: 'req', client_id, req_id, payload })
        else
          start_pinging() // no leader yet — buffer + keep pinging
      })
    },
    on_event(handler) {
      event_handlers.add(handler)
      return () => { event_handlers.delete(handler) }
    },
    on_ready(handler) {
      ready_handlers.add(handler)
      if (ready_meta !== null) handler(ready_meta)
      return () => { ready_handlers.delete(handler) }
    },
    ready(): Promise<unknown> {
      if (ready_meta !== null) return Promise.resolve(ready_meta)
      return new Promise((resolve) => { ready_waiters.push(resolve) })
    },
    destroy() {
      stop_pinging()
      for (const entry of pending.values()) clearTimeout(entry.timer)
      pending.clear()
      channel.close()
    },
  }
}

// ── server (leader dedicated worker) ────────────────────────────────────────

export interface TransportServer {
  /** Announce leadership + meta (call once the DB is open). */
  announce_ready: () => void
  /** Fan out a broadcast event to all tabs. */
  broadcast: (event: unknown) => void
  destroy: () => void
}

export function create_transport_server({ channel_name, on_request, get_meta }: {
  channel_name: string
  on_request: (payload: unknown) => Promise<unknown>
  get_meta: () => unknown
}): TransportServer {
  const channel = new BroadcastChannel(channel_name)
  const epoch = crypto.randomUUID()
  // Don't claim leadership to pinging clients until the DB is actually open
  // (`announce_ready`). Otherwise a first-load ping mid-download would resolve
  // clients before any rows exist.
  let is_ready = false

  channel.onmessage = async (event: MessageEvent<ChannelMessage>) => {
    const message = event.data
    if (message.kind === 'ping') {
      if (is_ready)
        channel.postMessage({ kind: 'ready', epoch, meta: get_meta() } satisfies ReadyMessage)
    } else if (message.kind === 'req') {
      try {
        const result = await on_request(message.payload)
        channel.postMessage({ kind: 'res', client_id: message.client_id, req_id: message.req_id, ok: true, result } satisfies ResponseMessage)
      } catch (err) {
        const code = (err as { code?: string }).code || 'internal'
        channel.postMessage({
          kind: 'res',
          client_id: message.client_id,
          req_id: message.req_id,
          ok: false,
          error: { code, message: (err as Error).message || 'Unknown error' },
        } satisfies ResponseMessage)
      }
    }
  }

  return {
    announce_ready() {
      is_ready = true
      channel.postMessage({ kind: 'ready', epoch, meta: get_meta() } satisfies ReadyMessage)
    },
    broadcast(event: unknown) {
      channel.postMessage({ kind: 'event', event } satisfies EventMessage)
    },
    destroy() {
      channel.close()
    },
  }
}
