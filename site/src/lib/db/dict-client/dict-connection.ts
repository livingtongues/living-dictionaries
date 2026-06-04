import type { SqliteConnection } from '$lib/db/client/connection'
import type {
  AuthHeaders,
  BroadcastMessage,
  ErrorResponse,
  OkResponse,
  OpenResult,
  QueryResult,
  RequestEnvelope,
  ResponseEnvelope,
} from './rpc-types'
import { is_broadcast } from './rpc-types'

/**
 * Main-thread shim that speaks RPC to the dict SharedWorker. Implements the
 * existing `SqliteConnection` interface so the LiveDb pattern from
 * `lib/db/client/live/*` can layer on top with minimal changes (`exec_raw`
 * is unsupported here — multi-statement SQL is the SharedWorker's job).
 *
 * One `DictConnection` per (port, dict_id) pair. Multiple dicts opened from
 * one tab share the same `MessagePort` to the SharedWorker (see
 * `shared-worker-lifecycle.ts`).
 */

export type BroadcastHandler = (broadcast: BroadcastMessage) => void

export interface DictConnectionInternals {
  port: MessagePort
  dict_id: string
}

export interface DictConnection extends SqliteConnection {
  /** Connection's dict_id. */
  readonly dict_id: string
  /** Subscribe to broadcasts for this dict (`tables_changed`, etc.). */
  subscribe_broadcasts: (handler: BroadcastHandler) => () => void
  /** Force a sync attempt (used by manual refresh / focus). */
  sync_now: () => Promise<void>
  /** OPFS-backed? (false = MemoryVFS fallback in the worker.) */
  readonly is_opfs_backed: boolean
}

interface CreateConnectionOptions {
  port: MessagePort
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
}

let req_counter = 0
function next_req_id(): number {
  req_counter += 1
  return req_counter
}

interface Pending {
  resolve: (envelope: OkResponse) => void
  reject: (error: Error & { code?: string }) => void
}

/**
 * Tie a single MessagePort to a request-id pool + broadcast subscribers.
 * `bind_port` is idempotent — calling it twice on the same port is a no-op.
 */
const port_state = new WeakMap<MessagePort, {
  pending: Map<number, Pending>
  broadcast_handlers: Map<string, Set<BroadcastHandler>>
}>()

function bind_port(port: MessagePort) {
  if (port_state.has(port))
    return
  const state = {
    pending: new Map<number, Pending>(),
    broadcast_handlers: new Map<string, Set<BroadcastHandler>>(),
  }
  port_state.set(port, state)
  port.onmessage = (event) => {
    const message = event.data as ResponseEnvelope | BroadcastMessage
    if ((message as ResponseEnvelope).req_id !== undefined) {
      const envelope = message as ResponseEnvelope
      const pending = state.pending.get(envelope.req_id)
      if (!pending)
        return
      state.pending.delete(envelope.req_id)
      if (envelope.type === 'ok') {
        pending.resolve(envelope)
      } else {
        const err = new Error(envelope.message) as Error & { code: string }
        err.code = envelope.code
        pending.reject(err)
      }
    } else if (is_broadcast(message as BroadcastMessage)) {
      const broadcast = message as BroadcastMessage
      const handlers = state.broadcast_handlers.get(broadcast.dict_id)
      if (!handlers)
        return
      for (const handler of handlers) {
        try { handler(broadcast) } catch (err) { console.error('[dict-connection] broadcast handler threw:', err) }
      }
    }
  }
  port.start?.()
}

function send<T = unknown>(port: MessagePort, message: RequestEnvelope): Promise<T> {
  bind_port(port)
  const state = port_state.get(port)!
  return new Promise<T>((resolve, reject) => {
    state.pending.set(message.req_id, {
      resolve: envelope => resolve(envelope.result as T),
      reject,
    })
    port.postMessage(message)
  })
}

function register_broadcast({ port, dict_id, handler }: { port: MessagePort, dict_id: string, handler: BroadcastHandler }) {
  bind_port(port)
  const state = port_state.get(port)!
  let handlers = state.broadcast_handlers.get(dict_id)
  if (!handlers) {
    handlers = new Set()
    state.broadcast_handlers.set(dict_id, handlers)
  }
  handlers.add(handler)
  return () => {
    handlers!.delete(handler)
    if (handlers!.size === 0)
      state.broadcast_handlers.delete(dict_id)
  }
}

/**
 * Initialize a connection: opens the dict in the SharedWorker (cached after
 * first open), and returns a `DictConnection` wired up to that port.
 *
 * Repeated calls for the same dict_id on the same port return a fresh
 * connection shim that shares the SharedWorker instance.
 */
export async function create_dict_connection(options: CreateConnectionOptions): Promise<{
  connection: DictConnection
  open_result: OpenResult
}> {
  bind_port(options.port)
  const result = await send<OpenResult>(options.port, {
    type: 'open',
    req_id: next_req_id(),
    dict_id: options.dict_id,
    has_editor_role: options.has_editor_role,
    auth: options.auth,
  })

  const internals: DictConnectionInternals = { port: options.port, dict_id: options.dict_id }

  const connection: DictConnection = {
    dict_id: options.dict_id,
    is_opfs_backed: result.opfs,

    query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return send<QueryResult>(internals.port, {
        type: 'query',
        req_id: next_req_id(),
        dict_id: internals.dict_id,
        sql,
        params,
      }).then(payload => payload.rows as T[])
    },

    execute(sql: string, params?: unknown[]): Promise<void> {
      // Heuristic: pull the affected table name from `UPDATE`/`INSERT`/`DELETE`
      // statements so the worker can broadcast a `tables_changed` event to
      // other tabs. Best-effort; over-broad notifications just trigger extra
      // re-queries on the other tabs (no correctness impact).
      const affected = extract_table_name(sql)
      return send<null>(internals.port, {
        type: 'exec',
        req_id: next_req_id(),
        dict_id: internals.dict_id,
        sql,
        params,
        affected_tables: affected ? [affected] : undefined,
      }).then(() => undefined)
    },

    exec_raw(_sql: string): Promise<void> {
      // exec_raw is for multi-statement SQL (e.g. migrations). For dict.db
      // those run inside the SharedWorker. Main-thread shouldn't need this.
      return Promise.reject(new Error('exec_raw is not supported on DictConnection — use migrations bundle inside the worker'))
    },

    async close(): Promise<void> {
      try {
        await send(internals.port, { type: 'close', req_id: next_req_id(), dict_id: internals.dict_id })
      } catch (err) {
        const { code } = err as { code?: string }
        if (code !== 'not_opened') throw err
      }
    },

    delete_db(): Promise<void> {
      // Equivalent to "drop and refetch" — close first, the SharedWorker's
      // shutdown path doesn't delete OPFS files automatically. Callers that
      // genuinely want to wipe the file go through `force_delete_opfs_file`
      // in the worker module directly.
      return this.close()
    },

    subscribe_broadcasts(handler) {
      return register_broadcast({ port: internals.port, dict_id: internals.dict_id, handler })
    },

    async sync_now(): Promise<void> {
      await send(internals.port, { type: 'sync_now', req_id: next_req_id(), dict_id: internals.dict_id })
    },
  }

  return { connection, open_result: result }
}

const TABLE_SQL_MATCH = /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)"?/i

export function extract_table_name(sql: string): string | null {
  const match = sql.match(TABLE_SQL_MATCH)
  return match?.[1] ?? null
}

if (import.meta.vitest) {
  describe(extract_table_name, () => {
    test('extracts from INSERT INTO', () => {
      expect(extract_table_name(`INSERT INTO "entries" (id) VALUES (?)`)).toBe('entries')
    })
    test('extracts from INSERT OR REPLACE INTO', () => {
      expect(extract_table_name(`INSERT OR REPLACE INTO senses (id) VALUES (?)`)).toBe('senses')
    })
    test('extracts from UPDATE', () => {
      expect(extract_table_name(`UPDATE entries SET dirty = NULL WHERE id = ?`)).toBe('entries')
    })
    test('extracts from DELETE', () => {
      expect(extract_table_name(`DELETE FROM "deletes" WHERE id = ?`)).toBe('deletes')
    })
    test('returns null for SELECT', () => {
      expect(extract_table_name(`SELECT * FROM entries`)).toBeNull()
    })
  })
}
