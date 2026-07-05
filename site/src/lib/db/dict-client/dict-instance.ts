import type { DbInstance, DbRequest, InstanceContext, InstanceFactory, InstanceOptions, LeaderMeta } from './worker/instance'
import type { OpfsConnection } from './worker/opfs-connection'
import type { DictWriteOutcome } from './dict-writes'
import { DICT_MIGRATION_NAMES, DICT_MIGRATIONS, LATEST_DICT_MIGRATION } from './dict-migrations-bundle'
import { DictSyncEngine } from './dict-sync-engine'
import { dispatch_dict_write } from './dict-writes'
import { evict_if_over_budget, touch_dict } from './opfs-lru'
import { fetch_dict_snapshot } from './fetch-snapshot'
import { open_memory_connection } from './memory-connection'
import { report_dict_storage_reopened, set_dict_log_session } from './report-dict-sync-failure'
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
 * constant below): the leader BLOCKS boot while it fetches → opens → migrates the
 * dict snapshot (the `+layout.ts` load `await`s `open_dict`), and each download
 * chunk + each boot phase `report_progress`-ticks the idle watchdog so a
 * slow-but-progressing download is never false-timed-out — only a TRUE stall (no
 * bytes/phase change for the idle window) trips it. Contrast house, which is
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
        await write_opfs_db_file({ path, bytes: fetched.bytes })
        console.info(`[dict-instance] ${dict_id} fetched fresh snapshot from ${fetched.source} (${fetched.bytes.length} bytes)`)
      } catch (err) {
        console.warn(`[dict-instance] ${dict_id} snapshot fetch failed — starting from an empty DB (sync will backfill):`, err)
      }
    }

    /**
     * Open + migrate the OPFS DB, with ONE self-heal retry: a crash mid-write
     * (journal_mode = MEMORY) or a bad snapshot can leave the file unopenable
     * (SQLITE_CANTOPEN / NOTADB surfaces on open or on the first migration
     * query). Without this the leader boots dead and every tab's RPC times out
     * until the user manually clears site data.
     */
    async function open_opfs_prepared(): Promise<OpfsConnection> {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (await opfs_file_exists({ path }))
            console.info(`[dict-instance] ${dict_id} opening existing OPFS file (no fetch)`)
          else
            await drop_in_snapshot()
          context.report_progress?.('opfs_open')
          const { connection: opened } = await open_opfs_connection({ path, foreign_keys: true })
          try {
            context.report_progress?.('migrate')
            await ensure_migrations({ dict_id, connection: opened })
            await ensure_metadata({ dict_id, connection: opened })
            return opened
          } catch (err) {
            await opened.close().catch(() => undefined)
            throw err
          }
        } catch (err) {
          if (attempt > 0)
            throw err
          console.warn(`[dict-instance] ${dict_id} self-heal: local DB unopenable — deleting + refetching:`, err)
          await delete_opfs_db_file({ path })
        }
      }
      throw new Error('unreachable')
    }

    async function open_and_wire(): Promise<void> {
      context.report_progress?.('probe')
      if (await opfs_is_available()) {
        connection = await open_opfs_prepared()
        is_opfs_backed = true
      } else {
        // No OPFS sync-access-handles (pre-iOS-17) — migrations run from
        // scratch and the sync engine backfills via pull-since-null.
        connection = await open_memory_connection({ foreign_keys: true })
        is_opfs_backed = false
        context.report_progress?.('migrate')
        await ensure_migrations({ dict_id, connection })
        await ensure_metadata({ dict_id, connection })
      }

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
      })
      engine.start()

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
      await reset().catch(err => console.error(`[dict-instance] ${dict_id} auto-reset failed:`, err))
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
    async function reset(): Promise<void> {
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
    const sql = DICT_MIGRATIONS[name]
    // SQLite can't BEGIN inside a multi-statement exec under wa-sqlite — run
    // each statement separately. We treat one migration file as one logical
    // unit; partial failure within a file is left to surface as an error
    // (callers see the broken state on next open + can reset).
    await connection.exec_raw(sql)
    await connection.execute(
      `INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)`,
      [crypto.randomUUID(), name, new Date().toISOString()],
    )
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
