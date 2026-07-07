import { statSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { log_server_event } from '$lib/server/log-server-event'
import { get_log_archive_db } from './log-archive-db'
import { get_logs_db } from './logs-db'
import { get_shared_db } from './shared-db'

/**
 * Periodic WAL truncation for the server's central better-sqlite3 files
 * (shared.db / logs.db / logs-archive.db).
 *
 * WHY: all our server DBs run in WAL mode, and better-sqlite3's default
 * auto-checkpoint is PASSIVE — it only checkpoints frames no reader is using,
 * and it NEVER shrinks the -wal file on disk (it just rewinds it for reuse).
 * On a busy, multi-connection DB (constant `/changes` sync + reader traffic +
 * the blue/green standby container also holding the file open) a PASSIVE
 * checkpoint keeps losing the race to concurrent readers, so the WAL
 * high-water mark ratchets up and never comes back down. Proven on house prod
 * 2026-07-06: a 189 MB shared.db WAL shrank to 80.5 KB after one TRUNCATE.
 * A fat WAL slows every read (more frames to walk) and turns a container
 * restart into a multi-hundred-MB replay.
 *
 * FIX: a `wal_checkpoint(TRUNCATE)` on a timer. TRUNCATE uses RESTART
 * semantics — it waits (up to each DB's `busy_timeout`) for readers to clear,
 * checkpoints EVERY frame, then truncates the -wal file back to zero bytes. If
 * a reader still pins the WAL at truncation time it returns `busy = 1` and we
 * try again next tick (and emit a watchable server event — see below).
 *
 * This is intentionally NOT surfaced on any dashboard: WAL health is an
 * agent-watched maintenance signal, not a human one. A healthy run is silent
 * (console only → ephemeral docker logs). It only writes a queryable
 * `wal_checkpoint_incomplete` server event when a checkpoint can't fully drain
 * — i.e. something is parking a long-lived read transaction (classic suspect:
 * the standby container) — so a log-reviewing agent can chase the real reader.
 *
 * Gating mirrors the other crons: dormant in dev/build, and IS_STANDBY-gated so
 * only the primary container runs it (both containers open the same files; the
 * primary owns all singleton maintenance).
 *
 * Scope: the CENTRAL DBs only — not per-dictionary `dictionaries/{id}.db`. Their
 * WAL-growth exposure is being investigated separately before extending the cron.
 * Ported from house/site/src/lib/db/server/wal-checkpoint-cron.ts.
 */

const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000 // every 5 min keeps the WAL small even under steady write load
/** A -wal still this large right after a TRUNCATE means a reader pinned it — worth an agent's attention. */
const WAL_WARN_BYTES = 64 * 1024 * 1024

interface CheckpointResult {
  name: string
  /** 1 when a reader prevented a full checkpoint/truncate (SQLite's `busy` column). */
  busy: number
  /** Frames in the WAL at checkpoint time. */
  log_frames: number
  /** Frames actually written back into the DB. */
  checkpointed_frames: number
  wal_bytes_before: number
  wal_bytes_after: number
}

function wal_bytes(db: Database.Database): number {
  try {
    return statSync(`${db.name}-wal`).size
  } catch {
    return 0 // -wal absent (checkpointed to nothing / :memory:) — treat as zero
  }
}

/**
 * Run `wal_checkpoint(TRUNCATE)` against one DB and report what happened.
 * Never throws — a checkpoint failure must not take down the sweep.
 */
export function checkpoint_wal({ db, name }: { db: Database.Database, name: string }): CheckpointResult {
  const wal_bytes_before = wal_bytes(db)
  let busy: number
  let log_frames = 0
  let checkpointed_frames = 0
  try {
    const [row] = db.pragma('wal_checkpoint(TRUNCATE)') as { busy: number, log: number, checkpointed: number }[]
    busy = row?.busy ?? 0
    log_frames = row?.log ?? 0
    checkpointed_frames = row?.checkpointed ?? 0
  } catch (err) {
    console.error(`[wal-checkpoint] '${name}' checkpoint threw:`, err)
    busy = 1
  }
  return { name, busy, log_frames, checkpointed_frames, wal_bytes_before, wal_bytes_after: wal_bytes(db) }
}

/**
 * One sweep: TRUNCATE-checkpoint every central server WAL file (shared / logs /
 * archive). Silent on healthy runs; emits a `wal_checkpoint_incomplete` server
 * event only when a DB couldn't fully drain (a pinning reader), so the signal is
 * queryable.
 */
export function run_wal_checkpoint_once({ dbs }: {
  dbs?: { db: Database.Database, name: string }[]
} = {}): CheckpointResult[] {
  const targets = dbs ?? [
    { db: get_shared_db(), name: 'shared.db' },
    { db: get_logs_db(), name: 'logs.db' },
    { db: get_log_archive_db(), name: 'logs-archive.db' },
  ]
  const results = targets.map(target => checkpoint_wal(target))
  for (const result of results) {
    const stuck = result.busy === 1 || result.wal_bytes_after > WAL_WARN_BYTES
    if (stuck) {
      console.warn(`[wal-checkpoint] '${result.name}' incomplete — busy=${result.busy}, wal ${mb(result.wal_bytes_before)}→${mb(result.wal_bytes_after)}, frames ${result.checkpointed_frames}/${result.log_frames}.`)
      // A reader is parking the WAL — surface it as a queryable server event so a
      // log-reviewing agent can hunt the culprit (prime suspect: the standby).
      log_server_event({
        level: 'warn',
        message: 'wal_checkpoint_incomplete',
        context: {
          db: result.name,
          busy: result.busy,
          log_frames: result.log_frames,
          checkpointed_frames: result.checkpointed_frames,
          wal_bytes_before: result.wal_bytes_before,
          wal_bytes_after: result.wal_bytes_after,
        },
      })
    }
  }
  return results
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

const SINGLETON_KEY = Symbol.for('living.wal-checkpoint-cron.state')
interface CronState { interval: ReturnType<typeof setInterval>, in_flight: boolean }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

export function start_wal_checkpoint_cron_once(): void {
  // dev/build: dormant locally (no long-lived busy WAL to tame).
  // IS_STANDBY: only the primary runs singleton maintenance (both containers
  // hold the same files open — the primary is the sole cron node).
  if (building || dev)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[wal-checkpoint] IS_STANDBY — cron disabled on standby container.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY]) {
    console.info('[wal-checkpoint] Already running — skip.')
    return
  }
  const state: CronState = {
    // .unref(): a background maintenance timer must never keep Node alive on its
    // own (matches the other crons; lets one-shot importers exit cleanly).
    interval: setInterval(() => run_guarded(state), CHECKPOINT_INTERVAL_MS).unref(),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  run_guarded(state) // first checkpoint on boot — reclaim whatever the previous container left behind
  console.info(`[wal-checkpoint] Started — truncating central server WALs every ${CHECKPOINT_INTERVAL_MS / 60_000} min.`)
}

export function stop_wal_checkpoint_cron(): void {
  const slot = globalThis as unknown as GlobalWithCron
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}

function run_guarded(state: CronState): void {
  if (state.in_flight)
    return
  state.in_flight = true
  try {
    const results = run_wal_checkpoint_once()
    const summary = results.map(result => `${result.name} ${mb(result.wal_bytes_before)}→${mb(result.wal_bytes_after)}`).join(', ')
    console.info(`[wal-checkpoint] ${summary}.`)
  } catch (err) {
    console.error('[wal-checkpoint] sweep failed:', err)
    log_server_event({ level: 'error', message: 'wal_checkpoint_sweep_failed', error: err })
  } finally {
    state.in_flight = false
  }
}
