import type { DbInstance, DbRequest, InstanceContext, InstanceFactory, InstanceOptions, LeaderMeta } from './worker/instance'
import type { OpfsConnection } from './worker/opfs-connection'
import type { DictWriteOutcome } from './dict-writes'
import { DICT_MIGRATION_NAMES, DICT_MIGRATIONS, LATEST_DICT_MIGRATION } from './dict-migrations-bundle'
import { DictSyncEngine } from './dict-sync-engine'
import { dispatch_dict_write } from './dict-writes'
import { evict_if_over_budget, touch_dict } from './opfs-lru'
import { fetch_dict_snapshot } from './fetch-snapshot'
import { open_memory_connection } from './memory-connection'
import { report_dict_boot, report_dict_self_healed, report_dict_storage_reopened, report_dict_sync_halted, set_dict_log_session } from './report-dict-sync-failure'
import { delete_opfs_db_file, open_opfs_connection, opfs_file_exists, write_opfs_db_file } from './worker/opfs-connection'
import { DICT_DB_OPFS_PREFIX } from '$lib/constants'

/**
 * The per-dictionary DB instance owned by the leader dedicated worker (the
 * role-instance the harness in `./worker/` plugs into — see `worker/instance.ts`
 * for the contract). ONE unified instance per dict, capability-gated: boots
 * viewer (pull-only) and is promoted to editor-push via `set_role` when an
 * editor tab connects — viewer + editor share one OPFS file, so house's
 * two-instance split does not apply.
 *
 * Boot strategy — `BLOCKING_SNAPSHOT_BOOT_WITH_IDLE_WATCHDOG` (see the named
 * constant below): the leader BLOCKS its own boot (doesn't announce `ready`)
 * while it fetches → opens → migrates the dict snapshot, and each download chunk
 * + each boot phase `report_progress`-ticks the idle watchdog so a
 * slow-but-progressing download is never false-timed-out — only a TRUE stall (no
 * bytes/phase change for the idle window) trips it. The MAIN thread no longer
 * blocks on this: `open_dict` returns the connection shim immediately and its
 * RPCs queue in the transport until this boot announces ready (so navigation is
 * instant and the boot bar streams the download). Contrast house, which is
 * naming its `progressive_snapshot_boot` (render-then-fill) side in its own repo.
 *
 * Boot: snapshot drop-in (viewer → public R2, editor → VPS) if the OPFS file
 * is missing → open with the held-SAH VFS (FK ON) → migrations → sync engine.
 * Falls back to MemoryVFS where OPFS sync-access-handles don't exist
 * (pre-iOS-17) — those re-pull everything each boot via `/changes?since=null`.
 *
 * Concurrency: a single op-level mutex serializes ALL writes — every `exec`
 * RPC, every `dict_write` op, and the engine's apply-transaction — so a write
 * statement never lands mid-sync-transaction on the shared connection. Reads
 * don't take the lock. Multi-statement logical writes (entry+sense,
 * media+junction, batch inserts, …) arrive as ONE `dict_write` RPC and run
 * inside `BEGIN/COMMIT` under the lock (see `../dict-writes.ts`), so the
 * group is atomic and can never interleave with a sync apply-transaction.
 */

/**
 * The explicit name of LD's dict-DB boot strategy: the leader worker blocks the
 * app's dict load while fetching + opening + migrating the snapshot, kept alive
 * by per-chunk/per-phase idle-watchdog ticks (vs a fixed timeout that would kill
 * a slow-but-live download). Surfaced for docs/telemetry so the strategy is
 * greppable rather than implicit in the boot flow.
 */
export const BOOT_STRATEGY = 'blocking_snapshot_boot_with_idle_watchdog'

export function create_dict_instance(options: InstanceOptions): InstanceFactory {
  return async (context: InstanceContext): Promise<DbInstance> => {
    const { dict_id } = options
    const path = `${DICT_DB_OPFS_PREFIX}${dict_id}.db`
    let { has_editor_role, auth } = options
    set_dict_log_session(options.session_id)

    let connection: OpfsConnection
    let engine: DictSyncEngine
    let is_opfs_backed = false
    // One automatic reset per worker lifetime — prevents a 410→reset→410 loop
    // if the server keeps rejecting the cursor even after a fresh snapshot.
    let auto_reset_attempted = false
    // One FK-wedge rebuild per worker lifetime — a reset lands a fresh
    // snapshot with a baked cursor, so a SECOND wedge in the same session
    // means something deeper is wrong (let the breaker halt + prompt).
    let rebuild_attempted = false
    // Storage-lost self-heal budget (browser closed our held OPFS handle —
    // observed after tab suspension/system sleep). Capped so a browser that
    // closes the handle right back doesn't reopen-loop; each reopen keeps the
    // file (and any dirty rows) in place, unlike reset().
    let reopen_attempts = 0
    let reopen_in_flight = false
    const MAX_REOPEN_ATTEMPTS = 3

    // Op-level mutex — serializes every write across exec / the engine's
    // apply-transaction so none enrols in another's SQLite txn.
    const op_lock = create_mutex()

    // Boot telemetry (`dict_boot` perf row): stage marks accumulate from the
    // first `mark_boot_stage` until the FIRST successful open_and_wire emits —
    // reopen/reset re-wires never re-emit (they have their own markers).
    const boot_marks: { stage: string, at: number }[] = []
    let boot_reported = false
    let boot_cold = false
    let boot_snapshot_bytes: number | null = null
    function mark_boot_stage(stage: string): void {
      if (!boot_reported)
        boot_marks.push({ stage, at: Date.now() })
    }
    function report_boot_complete(storage: 'opfs' | 'memory'): void {
      if (boot_reported || boot_marks.length === 0)
        return
      boot_reported = true
      const done_at = Date.now()
      const stage_ms: Record<string, number> = {}
      boot_marks.forEach(({ stage, at }, index) => {
        const next_at = boot_marks[index + 1]?.at ?? done_at
        stage_ms[stage] = (stage_ms[stage] ?? 0) + (next_at - at)
      })
      report_dict_boot({
        dict_id,
        duration_ms: done_at - boot_marks[0].at,
        cold: boot_cold || storage === 'memory',
        storage,
        snapshot_bytes: boot_snapshot_bytes,
        stage_ms,
      })
    }

    await open_and_wire()

    /**
     * Lay the snapshot into OPFS. A failed fetch (R2 404 for a brand-new dict
     * the cron hasn't built yet, offline first open, dev-only dict absent from
     * prod R2) is NOT fatal: we fall through to an empty OPFS DB — migrations
     * create the schema from scratch and the sync engine backfills via
     * `/changes?since=null`, exactly like the MemoryVFS path (but persistent).
     */
    async function drop_in_snapshot(): Promise<void> {
      try {
        boot_cold = true
        mark_boot_stage('snapshot_fetch')
        context.report_progress?.('snapshot_fetch')
        const fetched = await fetch_dict_snapshot({
          dict_id,
          has_editor_role,
          auth,
          // Per-chunk tick keeps the idle boot watchdog alive so a slow-but-
          // progressing download is never false-timed-out on a poor connection
          // (a dead connection — no bytes for the idle window — still trips it),
          // AND feeds the boot download progress bar with the byte counts.
          on_progress: ({ received_bytes, total_bytes }) => context.report_progress?.('snapshot_fetch', { received_bytes, total_bytes }),
        })
        boot_snapshot_bytes = fetched.bytes.length
        await write_opfs_db_file({ path, bytes: fetched.bytes })
        console.info(`[dict-instance] ${dict_id} fetched fresh snapshot from ${fetched.source} (${fetched.bytes.length} bytes)`)
      } catch (err) {
        console.warn(`[dict-instance] ${dict_id} snapshot fetch failed — starting from an empty DB (sync will backfill):`, err)
      }
    }

    /**
     * Open + migrate the OPFS DB in place. Never delete an existing file here:
     * an open failure means we cannot prove whether it contains unacknowledged
     * writes, so preservation wins over an automatic reset.
     */
    async function open_opfs_prepared(): Promise<OpfsConnection> {
      if (await opfs_file_exists({ path }))
        console.info(`[dict-instance] ${dict_id} opening existing OPFS file (no fetch)`)
      else
        await drop_in_snapshot()
      mark_boot_stage('opfs_open')
      context.report_progress?.('opfs_open')
      const { connection: opened } = await open_opfs_connection({ path, foreign_keys: true })
      try {
        mark_boot_stage('migrate')
        context.report_progress?.('migrate')
        await ensure_migrations({ dict_id, connection: opened })
        await ensure_metadata({ dict_id, connection: opened })
        return opened
      } catch (err) {
        await opened.close().catch(() => undefined)
        throw err
      }
    }

    async function open_and_wire(): Promise<void> {
      mark_boot_stage('probe')
      context.report_progress?.('probe')
      if (await opfs_is_available()) {
        connection = await open_opfs_prepared()
        is_opfs_backed = true
      } else {
        // No OPFS sync-access-handles (pre-iOS-17) — migrations run from
        // scratch and the sync engine backfills via pull-since-null.
        connection = await open_memory_connection({ foreign_keys: true })
        is_opfs_backed = false
        mark_boot_stage('migrate')
        context.report_progress?.('migrate')
        await ensure_migrations({ dict_id, connection })
        await ensure_metadata({ dict_id, connection })
      }

      mark_boot_stage('engine_start')
      context.report_progress?.('engine_start')
      engine = new DictSyncEngine({
        dict_id,
        connection,
        has_editor_role,
        get_auth: () => auth,
        serialize: op_lock,
        on_tables_changed: (tables) => {
          context.emit_event({ type: 'tables_changed', tables: [...tables] })
        },
        on_rows_deleted: (deletes) => {
          context.emit_event({ type: 'rows_deleted', deletes })
        },
        on_status: (status) => {
          context.emit_event({ type: 'sync_status', ...status })
        },
        on_storage_lost: () => { void reopen_after_storage_lost() },
        // Stale bundle: the engine has latched its retry loop (permanent until
        // reload). Broadcast to EVERY tab so the main-thread recovery reloads
        // onto a fresh bundle — this reaches the interval path, which used to
        // retry forever without ever broadcasting (see the client_behind storm
        // issue). Same broadcast `translate_sync_error` emits for the explicit
        // sync_now/reset paths; the +layout subscriber dedupes.
        on_version_blocked: () => { context.emit_event({ type: 'schema_outdated' }) },
        // Repeat-fatal circuit breaker tripped (same non-transient failure N×
        // in a row): the engine halted retrying. Ship ONE telemetry row from
        // the worker + broadcast so every tab prompts "changes aren't saving —
        // reload / contact us".
        on_repeated_failure: (info) => {
          report_dict_sync_halted({ dict_id, ...info })
          context.emit_event({ type: 'sync_halted' })
        },
        // FK-wedge self-heal (2nd consecutive fk_constraint apply failure):
        // the local DB is missing a parent row — flush any pending push, then
        // reset to a fresh snapshot. Fires before the breaker halts at 3.
        on_integrity_wedged: () => { void rebuild({ reason: 'fk_wedge' }) },
      })

      // NOTE: a pre-server_seq OPFS file (no `synced_seq` in db_metadata) needs
      // NO special handling here — the engine reads a null cursor and does a
      // full pull with prune-to-response (full-resync semantics), converging
      // the file in place. The old `seq_cursor_transition` rebuild (delete +
      // refetch snapshot) raced live queries with a torn-down connection
      // (SQLITE_MISUSE) and looped on worker respawn, wedging editors on
      // "Loading" forever (tutelo-saponi incident, 2026-07-13).
      engine.start()
      report_boot_complete(is_opfs_backed ? 'opfs' : 'memory')

      await touch_dict({ dict_id, is_editor: has_editor_role }).catch(() => { /* best-effort */ })
      // Opportunistic eviction in the background — never block opening. The
      // held-SAH guard inside skips this (and any other) live-leader dict.
      void evict_if_over_budget().catch(() => { /* best-effort */ })
    }

    function translate_sync_error(err: unknown): void {
      const { code } = err as { code?: string }
      if (code === 'snapshot_expired') {
        context.emit_event({ type: 'snapshot_expired' })
        // NOTE: deleting the OPFS file in place is a no-op while our SAH is
        // held (UNDELETABLE_WHEN_OPEN) — recovery must go through reset(),
        // which closes the connection first.
        void maybe_auto_reset()
      } else if (code === 'schema_outdated' || code === 'server_outdated') {
        context.emit_event({ type: 'schema_outdated' })
      }
    }

    /**
     * Recover from `snapshot_expired` (cursor > 60 days behind) by resetting to
     * a fresh snapshot — but ONLY when there are no un-pushed local writes.
     * Viewers never have pending writes, so they always self-recover. An editor
     * with dirty rows must not have them silently discarded: we leave the DB in
     * place (the `snapshot_expired` event is the UI's cue) and they keep
     * read-only access to their local data until a manual reset.
     */
    async function maybe_auto_reset(): Promise<void> {
      if (auto_reset_attempted)
        return
      auto_reset_attempted = true
      const pending = await engine.has_pending().catch(() => true)
      if (pending) {
        console.warn(`[dict-instance] ${dict_id} snapshot expired but un-pushed local writes exist — NOT auto-resetting`)
        return
      }
      console.warn(`[dict-instance] ${dict_id} snapshot expired — auto-resetting to a fresh snapshot`)
      await reset({ rescue_acknowledged: true }).catch(err => console.error(`[dict-instance] ${dict_id} auto-reset failed:`, err))
    }

    /**
     * FK-wedge self-heal: flush any un-pushed local writes to the server
     * (push-only — applying pulls is exactly what's failing in the wedge
     * state), then reset to a fresh snapshot. A failed sync has already
     * pushed its dirty rows server-side (the server commits push+pull in its
     * own transaction; the failure is the LOCAL apply), so the flush only
     * covers writes made since — and if the flush itself fails (offline, 5xx)
     * we ABORT rather than discard local work; the engine keeps retrying and
     * the breaker prompts at 3 as before.
     */
    async function rebuild({ reason }: { reason: 'fk_wedge' }): Promise<void> {
      if (rebuild_attempted)
        return
      rebuild_attempted = true
      let flushed_push: boolean
      try {
        flushed_push = await engine.flush_push_only()
      } catch (err) {
        console.warn(`[dict-instance] ${dict_id} rebuild (${reason}) aborted — could not flush un-pushed local writes:`, err)
        return
      }
      console.warn(`[dict-instance] ${dict_id} rebuilding from a fresh snapshot (${reason}; flushed_push=${flushed_push})`)
      report_dict_self_healed({ dict_id, reason, flushed_push })
      await reset({ rescue_acknowledged: true }).catch(err => console.error(`[dict-instance] ${dict_id} rebuild reset failed:`, err))
    }

    /**
     * Self-heal a browser-closed OPFS sync-access-handle (`storage_lost` — see
     * `is_storage_lost_error`): reopen the SAME file in place. Unlike `reset()`
     * this never deletes the DB, so un-pushed dirty rows survive. Without this
     * the engine's 30s interval hot-loops against the dead handle forever
     * (observed 2026-07-03: 112 failures over 80 min from one suspended tab).
     */
    async function reopen_after_storage_lost(): Promise<void> {
      if (reopen_in_flight || !is_opfs_backed)
        return
      if (reopen_attempts >= MAX_REOPEN_ATTEMPTS) {
        // Budget exhausted — stop the loop for good. Tabs' RPCs will fail and
        // the main-thread boot recovery takes over (respawn/leader hand-off).
        engine.stop()
        return
      }
      reopen_in_flight = true
      reopen_attempts += 1
      try {
        engine.stop()
        await op_lock(async () => {
          await connection.close().catch(() => undefined) // handle already dead
        })
        await open_and_wire()
        report_dict_storage_reopened({ dict_id, attempt: reopen_attempts })
        console.warn(`[dict-instance] ${dict_id} reopened OPFS connection after a closed access handle (attempt ${reopen_attempts})`)
      } catch (err) {
        console.error(`[dict-instance] ${dict_id} reopen after storage_lost failed:`, err)
      } finally {
        reopen_in_flight = false
      }
    }

    /** Tear down + recreate the OPFS DB from a fresh snapshot (danger zone). */
    async function reset({ rescue_acknowledged = false }: { rescue_acknowledged?: boolean } = {}): Promise<void> {
      if (!rescue_acknowledged) {
        await engine.flush_push_only()
        if (await engine.has_pending())
          throw new Error('reset refused: local writes lack durable server acknowledgement')
      }
      engine.stop()
      // Serialize the teardown through the op-mutex so an in-flight exec or
      // sync apply-transaction can't hit a closed connection mid-statement.
      await op_lock(async () => {
        await connection.close().catch(() => undefined)
        await delete_opfs_db_file({ path })
      })
      await open_and_wire()
      await engine.sync_once().catch((err) => { translate_sync_error(err) })
    }

    return {
      async handle(request: DbRequest): Promise<unknown> {
        switch (request.type) {
          case 'query':
            return connection.query(request.sql, request.params ?? [])
          case 'exec':
            return op_lock(async () => {
              // dirty=1 is already injected into the SQL by the calling LiveDb;
              // nothing extra to mark here.
              await connection.execute(request.sql, request.params ?? [])
              if (request.affected_tables?.length)
                context.emit_event({ type: 'tables_changed', tables: request.affected_tables })
              if (request.deleted_rows?.length)
                context.emit_event({ type: 'rows_deleted', deletes: request.deleted_rows })
              // Schedule a push if this was an editor write — the engine
              // no-ops while a sync is already in flight.
              if (has_editor_role)
                void engine.sync_if_needed()
              return null
            })
          case 'dict_write':
            // Atomic multi-statement write: the whole orchestrator runs inside
            // BEGIN/COMMIT under the op-mutex, so the group commits or rolls
            // back as one and can never interleave with a sync apply-txn.
            return op_lock(async () => {
              await connection.execute('BEGIN')
              let outcome: DictWriteOutcome
              try {
                outcome = await dispatch_dict_write({ op: request.op, connection, args: request.args })
                await connection.execute('COMMIT')
              } catch (err) {
                await connection.execute('ROLLBACK').catch(() => undefined)
                throw err
              }
              if (outcome.affected_tables.length)
                context.emit_event({ type: 'tables_changed', tables: outcome.affected_tables })
              if (outcome.deleted_rows?.length)
                context.emit_event({ type: 'rows_deleted', deletes: outcome.deleted_rows })
              if (has_editor_role)
                void engine.sync_if_needed()
              return outcome
            })
          case 'sync_now':
            await engine.sync_once().catch((err) => {
              translate_sync_error(err)
              throw err
            })
            return null
          case 'set_role':
            ;({ auth } = request)
            // Promote viewer → editor in place (idempotent; never demote — the
            // server re-checks the caller's role on every push anyway).
            if (request.has_editor_role && !has_editor_role) {
              has_editor_role = true
              engine.set_role(true)
              void touch_dict({ dict_id, is_editor: true }).catch(() => { /* best-effort */ })
            }
            return null
          case 'reset':
            await reset()
            return null
          default: {
            const unknown_type = (request as { type?: string }).type
            const err = new Error(`dict instance: unsupported op ${unknown_type}`) as Error & { code: string }
            err.code = 'internal'
            throw err
          }
        }
      },
      meta: (): LeaderMeta => ({
        persistent: is_opfs_backed,
        schema_version: LATEST_DICT_MIGRATION,
        has_editor_role,
      }),
      async shutdown(): Promise<void> {
        engine.stop()
        await connection.close().catch(() => undefined)
      },
    }
  }
}

/** True if the runtime has OPFS + SyncAccessHandle (required by the SAH VFS). */
async function opfs_is_available(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory)
      return false
    const root = await navigator.storage.getDirectory()
    const probe = await root.getFileHandle('.opfs-probe', { create: true })
    if (typeof (probe as { createSyncAccessHandle?: unknown }).createSyncAccessHandle !== 'function')
      return false
    try { await root.removeEntry('.opfs-probe') } catch { /* best-effort */ }
    return true
  } catch {
    return false
  }
}

async function ensure_migrations({ dict_id, connection }: { dict_id: string, connection: OpfsConnection }) {
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
    const sql = await make_additive_migration_resumable({ connection, sql: DICT_MIGRATIONS[name] })
    await connection.execute('BEGIN')
    try {
      await connection.exec_raw(sql)
      await connection.execute(
        `INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)`,
        [crypto.randomUUID(), name, new Date().toISOString()],
      )
      await connection.execute('COMMIT')
    } catch (error) {
      await connection.execute('ROLLBACK').catch(() => undefined)
      throw error
    }
  }
  if (LATEST_DICT_MIGRATION) {
    await connection.execute(
      `INSERT INTO db_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
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
    console.warn(`[dict-instance] OPFS file for ${dict_id} self-reports as ${id_row[0].value}`)
}

export async function make_additive_migration_resumable({ connection, sql }: { connection: Pick<OpfsConnection, 'query'>, sql: string }): Promise<string> {
  const statements = sql.split(';')
  const repaired: string[] = []
  for (const statement of statements) {
    const match = /\bALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/.exec(statement)
    if (!match) {
      repaired.push(statement)
      continue
    }
    const [, table_name, column_name] = match
    const columns = await connection.query<{ name: string, type: string, notnull: number }>(`PRAGMA table_info(${table_name})`)
    const existing = columns.find(column => column.name === column_name)
    if (!existing) {
      repaired.push(statement)
      continue
    }
    const definition = statement.slice((match.index ?? 0) + match[0].length).trim()
    const expected_type = /^([A-Z]+)/i.exec(definition)?.[1]?.toUpperCase() ?? ''
    const expected_not_null = /\bNOT NULL\b/i.test(definition)
    if (existing.type.toUpperCase() !== expected_type || Boolean(existing.notnull) !== expected_not_null)
      throw new Error(`migration repair refused: ${table_name}.${column_name} does not match the declared additive column`)
  }
  return repaired.join(';')
}

async function ensure_metadata({ dict_id, connection }: { dict_id: string, connection: OpfsConnection }) {
  await connection.execute(
    `INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)`,
    ['dictionary_id', dict_id],
  )
}

function create_mutex() {
  let queue: Promise<unknown> = Promise.resolve()
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn)
    const noop = () => undefined
    queue = next.then(noop, noop)
    return next as Promise<T>
  }
}
