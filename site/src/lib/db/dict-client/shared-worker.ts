import type {
  AuthHeaders,
  BroadcastMessage,
  ErrorResponse,
  OkResponse,
  OpenResult,
  QueryResult,
  RequestEnvelope,
} from './rpc-types'
import type { DictSqliteConnection } from './opfs-vfs-loader'
import { DICT_MIGRATION_NAMES, DICT_MIGRATIONS, LATEST_DICT_MIGRATION } from './dict-migrations-bundle'
import { DictSyncEngine } from './dict-sync-engine'
import { evict_if_over_budget, touch_dict } from './opfs-lru'
import { fetch_dict_snapshot } from './fetch-snapshot'
import { force_delete_opfs_file, open_dict_connection } from './opfs-vfs-loader'

/**
 * SharedWorker entry for `dictionaries/{id}.db`. One per origin; every tab
 * opens a `MessagePort` and posts RPC commands. The worker holds an LRU
 * cache of open wa-sqlite + OPFS instances (one per dict), runs a sync
 * engine inside the worker, and broadcasts table-change notifications to
 * all connected ports.
 *
 * See `port-db-sync-architecture.md` Story B.1 for the full spec.
 */

// Tell TypeScript this module runs in a SharedWorker context. The project's
// tsconfig only ships the DOM lib (not WebWorker), so we declare the bits
// we use locally rather than pulling in the whole lib.
interface SharedWorkerScope {
  onconnect: ((event: MessageEvent) => void) | null
}
declare const self: SharedWorkerScope

interface DictInstance {
  dict_id: string
  connection: DictSqliteConnection
  engine: DictSyncEngine
  has_editor_role: boolean
  /** Set of ports holding a refcount. Empty → eligible for shutdown. */
  ports: Set<MessagePort>
}

interface PortContext {
  port: MessagePort
  auth: AuthHeaders
  dicts: Set<string>
}

const ports = new Map<MessagePort, PortContext>()
const dicts = new Map<string, DictInstance>()
const opening = new Map<string, Promise<DictInstance>>()

self.onconnect = (event: MessageEvent) => {
  const [port] = (event as unknown as { ports: MessagePort[] }).ports
  const context: PortContext = { port, auth: {}, dicts: new Set() }
  ports.set(port, context)
  port.onmessage = (event_) => { void handle_message(context, event_.data as RequestEnvelope) }
  port.start?.()
}

async function handle_message(context: PortContext, message: RequestEnvelope): Promise<void> {
  try {
    switch (message.type) {
      case 'open': {
        const result = await open_dict({ context, message })
        respond_ok({ port: context.port, req_id: message.req_id, result })
        return
      }
      case 'query': {
        const instance = require_instance(message.dict_id)
        const rows = await instance.connection.query<Record<string, unknown>>(message.sql, message.params ?? [])
        respond_ok({ port: context.port, req_id: message.req_id, result: { rows } satisfies QueryResult })
        return
      }
      case 'exec': {
        await handle_exec({ context, message })
        return
      }
      case 'close': {
        await handle_close({ context, dict_id: message.dict_id })
        respond_ok({ port: context.port, req_id: message.req_id, result: null })
        return
      }
      case 'bye': {
        await handle_bye(context)
        respond_ok({ port: context.port, req_id: message.req_id, result: null })
        return
      }
      case 'refresh_auth': {
        context.auth = message.auth
        respond_ok({ port: context.port, req_id: message.req_id, result: null })
        return
      }
      case 'sync_now': {
        const instance = require_instance(message.dict_id)
        await instance.engine.sync_once().catch((err) => {
          translate_sync_error({ instance, err })
          throw err
        })
        respond_ok({ port: context.port, req_id: message.req_id, result: null })
        return
      }
      default: {
        const unknown_type = (message as { type?: string }).type
        respond_error({
          port: context.port,
          req_id: (message as { req_id: number }).req_id,
          code: 'internal',
          message: `Unknown request type: ${unknown_type}`,
        })
      }
    }
  } catch (err) {
    const code = (err as { code?: string }).code as ErrorResponse['code'] | undefined
    respond_error({
      port: context.port,
      req_id: (message as { req_id: number }).req_id,
      code: code || 'internal',
      message: (err as Error).message || 'Unknown error',
    })
  }
}

async function open_dict({ context, message }: {
  context: PortContext
  message: Extract<RequestEnvelope, { type: 'open' }>
}): Promise<OpenResult> {
  const { dict_id, has_editor_role, auth } = message
  context.auth = auth

  let instance = dicts.get(dict_id)
  if (!instance) {
    let inflight = opening.get(dict_id)
    if (!inflight) {
      inflight = boot_instance({ dict_id, has_editor_role, auth })
      opening.set(dict_id, inflight)
    }
    try {
      instance = await inflight
    } finally {
      opening.delete(dict_id)
    }
  }

  // Promote viewer → editor if this caller has the role.
  if (has_editor_role && !instance.has_editor_role) {
    instance.has_editor_role = true
    instance.engine.set_role(true)
  }

  // Track refcount + LRU.
  instance.ports.add(context.port)
  context.dicts.add(dict_id)

  await touch_dict({ dict_id, is_editor: instance.has_editor_role }).catch(() => { /* best-effort */ })

  return {
    opfs: instance.connection.is_opfs_backed,
    schema_version: LATEST_DICT_MIGRATION,
    was_fresh_fetch: false,
  }
}

interface BootOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
}

async function boot_instance({ dict_id, has_editor_role, auth }: BootOptions): Promise<DictInstance> {
  const open_result = await open_dict_connection({
    dict_id,
    fetch_snapshot: async () => {
      const fetched = await fetch_dict_snapshot({ dict_id, has_editor_role, auth })
      return fetched.bytes
    },
  })

  await ensure_migrations({ dict_id, connection: open_result.connection })
  await ensure_metadata({ dict_id, connection: open_result.connection })

  const engine = new DictSyncEngine({
    dict_id,
    connection: open_result.connection,
    has_editor_role,
    get_auth: () => latest_auth_for_dict(dict_id),
    on_tables_changed: (tables) => {
      broadcast_to_dict({
        dict_id,
        message: { type: 'tables_changed', dict_id, tables: [...tables] },
      })
    },
    on_status: (status) => {
      broadcast_to_dict({
        dict_id,
        message: { type: 'sync_status', dict_id, ...status },
      })
    },
  })

  const instance: DictInstance = {
    dict_id,
    connection: open_result.connection,
    engine,
    has_editor_role,
    ports: new Set(),
  }
  dicts.set(dict_id, instance)
  engine.start()

  // Kick off opportunistic eviction in the background — never block opening.
  void evict_if_over_budget({ open_dict_ids: new Set(dicts.keys()) }).catch(() => { /* best-effort */ })

  return instance
}

async function ensure_migrations({ dict_id, connection }: { dict_id: string, connection: DictSqliteConnection }) {
  // Bootstrap the migrations table if missing. The first migration creates
  // it, so for a freshly-fetched OPFS snapshot the table already exists
  // and these probes are no-ops. For a brand-new MemoryVFS instance with no
  // snapshot, we run all migrations from scratch.
  const has_table = await connection.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`,
  )
  let applied = new Set<string>()
  if (has_table.length) {
    const rows = await connection.query<{ name: string }>(`SELECT name FROM migrations`)
    applied = new Set(rows.map(row => row.name))
  }
  for (const name of DICT_MIGRATION_NAMES) {
    if (applied.has(name))
      continue
    const sql = DICT_MIGRATIONS[name]
    // SQLite can't BEGIN inside a multi-statement exec under wa-sqlite — run
    // each statement separately. We treat one migration file as one logical
    // unit; partial failure within a file is left to surface as an error
    // (callers see the broken state on next open + can `force_delete`).
    await connection.exec_raw(sql)
    await connection.execute(
      `INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)`,
      [crypto.randomUUID(), name, new Date().toISOString()],
    )
  }
  if (LATEST_DICT_MIGRATION) {
    await connection.execute(
      `INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)`,
      ['schema_version', LATEST_DICT_MIGRATION],
    )
  }
  // Defensive cross-check that the OPFS file we opened belongs to this dict.
  // `dictionary_id` is written by both the server (via `get_dictionary_db`)
  // and `ensure_metadata` below, so the only failure mode is "OPFS file
  // collided / was tampered with" — we log loudly rather than refuse to
  // open (the user wouldn't be able to do anything about it anyway).
  const id_row = await connection.query<{ value: string }>(
    `SELECT value FROM db_metadata WHERE key = 'dictionary_id'`,
  )
  if (id_row[0]?.value && id_row[0].value !== dict_id)
    console.warn(`[dict-shared-worker] OPFS file for ${dict_id} self-reports as ${id_row[0].value}`)
}

async function ensure_metadata({ dict_id, connection }: { dict_id: string, connection: DictSqliteConnection }) {
  await connection.execute(
    `INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)`,
    ['dictionary_id', dict_id],
  )
}

async function handle_exec({ context, message }: {
  context: PortContext
  message: Extract<RequestEnvelope, { type: 'exec' }>
}): Promise<void> {
  const instance = require_instance(message.dict_id)
  // Mark `dirty=1` on any direct write — but only for editor tabs. The
  // calling LiveDb already injected dirty=1 into the row data on insert /
  // update / upsert SQL so we don't need to do anything extra here; the
  // sync engine reads rows WHERE dirty=1 on next sync.
  await instance.connection.execute(message.sql, message.params ?? [])
  respond_ok({ port: context.port, req_id: message.req_id, result: null })

  // Broadcast table-change notification so OTHER tabs of this dict re-query.
  if (message.affected_tables?.length) {
    broadcast_to_dict({
      dict_id: message.dict_id,
      message: { type: 'tables_changed', dict_id: message.dict_id, tables: message.affected_tables },
      exclude_port: context.port,
    })
  }

  // Schedule a sync attempt if this was an editor write — the engine debounces
  // internally so a burst of writes still produces one push.
  if (instance.has_editor_role)
    void instance.engine.sync_if_needed()
}

async function handle_close({ context, dict_id }: { context: PortContext, dict_id: string }) {
  const instance = dicts.get(dict_id)
  if (!instance)
    return
  instance.ports.delete(context.port)
  context.dicts.delete(dict_id)
  if (instance.ports.size === 0)
    await shutdown_instance(instance)
}

async function handle_bye(context: PortContext) {
  for (const dict_id of context.dicts) {
    const instance = dicts.get(dict_id)
    if (!instance) continue
    instance.ports.delete(context.port)
    if (instance.ports.size === 0)
      await shutdown_instance(instance)
  }
  context.dicts.clear()
  ports.delete(context.port)
}

async function shutdown_instance(instance: DictInstance) {
  instance.engine.stop()
  try { await instance.connection.close() } catch { /* best-effort */ }
  dicts.delete(instance.dict_id)
}

function require_instance(dict_id: string): DictInstance {
  const instance = dicts.get(dict_id)
  if (!instance) {
    const err = new Error(`Dict ${dict_id} not opened on this worker`)
    ;(err as Error & { code: string }).code = 'not_opened'
    throw err
  }
  return instance
}

function latest_auth_for_dict(dict_id: string): AuthHeaders {
  // Prefer any editor port's auth; fall back to first connected port's auth.
  for (const ctx of ports.values()) {
    if (ctx.dicts.has(dict_id))
      return ctx.auth
  }
  return {}
}

function broadcast_to_dict({ dict_id, message, exclude_port }: {
  dict_id: string
  message: BroadcastMessage
  exclude_port?: MessagePort
}) {
  const instance = dicts.get(dict_id)
  if (!instance)
    return
  for (const port of instance.ports) {
    if (port === exclude_port)
      continue
    try { port.postMessage(message) } catch { /* port dead */ }
  }
}

function translate_sync_error({ instance, err }: { instance: DictInstance, err: unknown }) {
  const { code } = err as { code?: string }
  if (code === 'snapshot_expired') {
    broadcast_to_dict({ dict_id: instance.dict_id, message: { type: 'snapshot_expired', dict_id: instance.dict_id } })
    // Best-effort: drop the OPFS file so the next open re-fetches.
    void force_delete_opfs_file(instance.dict_id).catch(() => { /* swallow */ })
  } else if (code === 'schema_outdated' || code === 'server_outdated') {
    broadcast_to_dict({ dict_id: instance.dict_id, message: { type: 'schema_outdated', dict_id: instance.dict_id } })
  }
}

function respond_ok<T>({ port, req_id, result }: { port: MessagePort, req_id: number, result: T }) {
  port.postMessage({ type: 'ok', req_id, result } satisfies OkResponse<T>)
}

function respond_error({ port, req_id, code, message }: { port: MessagePort, req_id: number, code: ErrorResponse['code'], message: string }) {
  port.postMessage({ type: 'error', req_id, code, message } satisfies ErrorResponse)
}
