import type Database from 'better-sqlite3'
import type { Audience, LogAnalytics } from './log-analytics'
import { fork } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { setPriority } from 'node:os'
import { setTimeout } from 'node:timers'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { building, dev } from '$app/environment'
import { log_server_event } from '$lib/server/log-server-event'
import SqliteDatabase from 'better-sqlite3'
import { get_log_analytics } from './log-analytics'
import type { RetentionSweepSummary } from './log-retention-cron'
import { sweep_log_retention_in_child } from './log-retention-cron'
import { compute_monthly_metrics, missing_metric_months, save_monthly_metrics } from './monthly-metrics'

/**
 * THE analytics dashboards' data source: one JSON file per (window, audience),
 * written ONCE A DAY by a `nice`d CHILD PROCESS. The server process never
 * computes analytics — `/admin/analytics` and `/admin/health` are a `readFileSync`
 * and a `JSON.parse`.
 *
 * WHY THIS EXISTS (2026-07-30, vps-setup `.issues/analytics-and-cron-simplification.md`):
 * `get_log_analytics` scans a 30-day window of raw `client_logs` — 1.3M rows
 * across a 2.1 GB `logs.db` — and better-sqlite3 is synchronous, so every one of
 * those 11–80 s computes made the event loop unreachable INSIDE THE SERVING
 * PROCESS. Two years of mitigation accreted around that one fact: `breathe()`
 * chunking, a stale-while-revalidate memo, disk persistence for the memo, a boot
 * warm-up, a boot-readiness hold, `IS_STANDBY` gates. Every layer existed to make
 * a blocking computation survivable on a request thread. It took the site down
 * anyway (the 2026-07-29 Living 503).
 *
 * Jacob's ruling: dashboards are a TREND surface, not an investigation tool —
 * "the last 10 hours don't matter". So nothing here is live. A daily checkpoint
 * computes everything off-box-hours, off-thread, at nice 19; the request path
 * reads the result. Standing law: nothing from analytics may ever slow, bog down
 * or block the machine.
 *
 * WHY A CHILD PROCESS AND NOT A WORKER THREAD: `nice` applies to a process (a
 * thread inherits the process priority and Node exposes no per-thread hook), the
 * child's RSS is fully reclaimed by its exit, and an OOM kills the child instead
 * of the site.
 *
 * HOW THE CHILD FINDS ITS OWN CODE — the load-bearing trick: the Docker runner
 * copies only `site/build`, so a `.ts` file next to this one does not exist at
 * runtime (the same constraint that makes `routes/og/render-worker.js` a `?raw`
 * string). But a BUNDLED CHUNK is a real file at a real path, and rollup keeps
 * `import.meta.url` intact in its ESM output — so this module forks the chunk
 * that CONTAINS it and re-enters through the `ANALYTICS_SNAPSHOT_CHILD` guard at
 * the bottom of this file. Verified against production builds: importing that
 * chunk standalone takes ~25 ms and opens no databases.
 *
 * CONSEQUENCES of re-entering through a chunk, both load-bearing:
 *  - `$env/dynamic/private` is EMPTY in the child. It is populated by
 *    `Server.init()` in `build/index.js`, which the child never runs — so
 *    everything here reads `process.env` directly (identical values: the
 *    container's env_file feeds both).
 *  - The child must not import `hooks.server.ts` (it doesn't) — no migrations, no
 *    crons, no HTTP listener. It opens READ-ONLY database handles, computes,
 *    writes files, reports over IPC and exits.
 */

/**
 * Payload-shape version. **Bump whenever `LogAnalytics` changes shape** (a new
 * panel field, a renamed key) — older files then read as "no snapshot" instead of
 * hydrating the dashboard with a payload the current UI can't render.
 */
export const SNAPSHOT_FORMAT = 1

/**
 * Windows the dashboards can ask for. LD's two admin pages are both fixed at 30
 * days, so this is one entry — house's copy of this file carries its 7/30/90/all
 * range selector. Kept as a list so both apps' shape stays the same.
 */
export const SNAPSHOT_RANGES = ['30'] as const
export type SnapshotRange = typeof SNAPSHOT_RANGES[number]

/** Both audiences are precomputed: the Humans/Bots toggle must never trigger a compute. */
export const SNAPSHOT_AUDIENCES: Audience[] = ['humans', 'bots']

/** Every (range, audience) the UI can request — the child computes all of them. */
export function snapshot_targets(): { range: SnapshotRange, audience: Audience }[] {
  return SNAPSHOT_RANGES.flatMap(range => SNAPSHOT_AUDIENCES.map(audience => ({ range, audience })))
}

export interface AnalyticsSnapshot {
  format: number
  /** When the child computed this payload (its own `payload.generated_at`). */
  generated_at: string
  /** Compute cost, for the "how expensive is this really" question. */
  computed_ms: number
  range: SnapshotRange
  audience: Audience
  /** Why the child ran: `cron` | `boot-catchup` | `manual`. */
  reason: string
  payload: LogAnalytics
}

/**
 * `<DATA_DIR>/analytics/` — a NEW directory, deliberately not the old
 * `analytics-cache/` (that one held SWR memo entries in a different envelope, and
 * house's copy accumulated one orphaned file per day as its all-time window grew).
 * The job deletes the legacy directory on its first run.
 */
export function snapshot_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'analytics')
}

const LEGACY_CACHE_DIR = 'analytics-cache'

/** `30` + `humans` → `30-humans`. Only word chars and hyphens, so a key can never escape the directory. */
export function snapshot_key({ range, audience }: { range: SnapshotRange, audience: Audience }): string {
  return `${range}-${audience}`.replace(/[^\w-]+/g, '-')
}

function snapshot_path(key: string): string {
  return join(snapshot_dir(), `${key}.json`)
}

/**
 * The dashboards' whole read path. Fail-open by design: a missing, truncated,
 * corrupt or older-format file reads as `null`, which renders the "no checkpoint
 * yet" state with a Recompute button — never a computation, never a 500.
 */
export function read_analytics_snapshot({ range, audience }: { range: SnapshotRange, audience: Audience }): AnalyticsSnapshot | null {
  let raw: string
  try {
    raw = readFileSync(snapshot_path(snapshot_key({ range, audience })), 'utf8')
  } catch {
    return null // not computed yet
  }
  try {
    const parsed = JSON.parse(raw) as AnalyticsSnapshot
    if (!parsed || parsed.format !== SNAPSHOT_FORMAT || !parsed.payload)
      return null
    return parsed
  } catch {
    return null // half-written or hand-edited — treat as absent
  }
}

/**
 * Atomic: write a uniquely-named temp file, then rename. A crash mid-write cannot
 * leave a half-parsed payload, and the blue/green pair can write the same key
 * concurrently (each renames its own complete file).
 */
function write_analytics_snapshot(snapshot: AnalyticsSnapshot): number {
  const path = snapshot_path(snapshot_key(snapshot))
  mkdirSync(snapshot_dir(), { recursive: true })
  const json = JSON.stringify(snapshot)
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temp, json)
  renameSync(temp, path)
  return json.length
}

/**
 * Delete files no target owns any more (a retired range, a renamed audience, a
 * leftover `.tmp`) plus the legacy SWR cache directory — so the volume can't
 * accumulate dead payloads the way `analytics-cache/` did.
 */
function prune_stale_files(): string[] {
  const keep = new Set(snapshot_targets().map(target => `${snapshot_key(target)}.json`))
  const removed: string[] = []
  try {
    for (const name of readdirSync(snapshot_dir())) {
      if (keep.has(name))
        continue
      rmSync(join(snapshot_dir(), name), { force: true })
      removed.push(name)
    }
  } catch {
    // directory doesn't exist yet — nothing to prune
  }
  rmSync(join(process.env.DATA_DIR || '.data', LEGACY_CACHE_DIR), { recursive: true, force: true })
  return removed
}

export interface SnapshotJobSummary {
  reason: string
  duration_ms: number
  /**
   * Peak RSS the child reached, in MB — the number that says whether
   * `CHILD_MAX_HEAP_MB` is anywhere near being hit. Measured after each target, so
   * it's the high-water mark across the whole run.
   */
  peak_rss_mb: number
  written: { key: string, computed_ms: number, bytes: number }[]
  failed: { key: string, message: string }[]
  pruned: string[]
  /** Months whose `monthly_metrics` row this run computed (usually none — only
   *  on the 1st, or on the first deploy that backfills). */
  monthly_metrics: string[]
  /** The daily retention sweep, when this run was asked to do it first (cron only). */
  retention?: RetentionSweepSummary
}

/**
 * Read-only handle, opened by the CHILD against the live files while the server
 * holds them open in WAL mode. Read-only is the point: the child cannot corrupt,
 * lock or migrate anything, and `get_shared_db()`'s migration runner never fires
 * here. (SQLite permits `CREATE TEMP TABLE` and custom functions on a read-only
 * connection, which the analytics reader needs — verified.)
 *
 * Expect `-shm`/`-wal` files to exist afterwards: a read-only connection to a WAL
 * database still needs the shared-memory index, and creates a zero-length pair if no
 * writer is holding one. Harmless — in production the server already holds both open
 * and the child just attaches.
 */
function open_read_only(path: string): Database.Database {
  const db = new SqliteDatabase(path, { readonly: true, fileMustExist: true })
  db.pragma('busy_timeout = 5000')
  return db
}

function try_open_read_only(path: string): Database.Database | null {
  try {
    return open_read_only(path)
  } catch {
    return null
  }
}

/**
 * Compute every target and write it. Runs in the CHILD (and inline in dev, where
 * there is no bundle to fork). Each payload is written as soon as it's computed,
 * so a crash on the last target still leaves the earlier ones fresh.
 */
export async function run_analytics_snapshot_job({ reason, sweep_retention = false, now = () => new Date() }: {
  reason: string
  /**
   * Run the daily log-retention sweep BEFORE computing (the daily cron only).
   *
   * One fork does both because the order is load-bearing and always has been:
   * the sweep advances the rollup watermark, so the analytics payload is built
   * on finalized rollups instead of re-scanning raw rows for a day that was
   * about to be materialized anyway — and the monthly freeze below then measures
   * a month the sweep has already closed.
   */
  sweep_retention?: boolean
  /** Test seam — the child stamps each payload with its own compute time. */
  now?: () => Date
}): Promise<SnapshotJobSummary> {
  const started = performance.now()
  const data_dir = process.env.DATA_DIR || '.data'
  const summary: SnapshotJobSummary = { reason, duration_ms: 0, peak_rss_mb: 0, written: [], failed: [], pruned: [], monthly_metrics: [] }
  // FIRST, and with its own handles: the sweep WRITES (rollups, archive moves,
  // VACUUM), the compute below is strictly read-only. Never throws.
  if (sweep_retention)
    summary.retention = sweep_log_retention_in_child({ data_dir, now: now() })
  let shared_db: Database.Database | null = null
  let logs_db: Database.Database | null = null
  let archive_db: Database.Database | null = null
  try {
    shared_db = open_read_only(join(data_dir, 'shared.db'))
    logs_db = open_read_only(join(data_dir, 'logs.db'))
    archive_db = try_open_read_only(join(data_dir, 'logs-archive.db'))
    for (const target of snapshot_targets()) {
      const key = snapshot_key(target)
      const compute_started = performance.now()
      try {
        const payload = await get_log_analytics({
          shared_db,
          logs_db,
          archive_db,
          days: Number(target.range),
          now: now(),
          audience: target.audience,
        })
        const computed_ms = Math.round(performance.now() - compute_started)
        const bytes = write_analytics_snapshot({
          format: SNAPSHOT_FORMAT,
          generated_at: payload.generated_at,
          computed_ms,
          range: target.range,
          audience: target.audience,
          reason,
          payload,
        })
        summary.written.push({ key, computed_ms, bytes })
        summary.peak_rss_mb = Math.max(summary.peak_rss_mb, Math.round(process.memoryUsage().rss / 1024 / 1024))
        console.info(`[analytics-snapshot] ${key} computed in ${computed_ms}ms (${Math.round(bytes / 1024)} KB, rss ${summary.peak_rss_mb} MB).`)
      } catch (error) {
        summary.failed.push({ key, message: (error as Error).message })
        console.error(`[analytics-snapshot] ${key} failed:`, error)
      }
    }
    summary.pruned = prune_stale_files()
    summary.monthly_metrics = freeze_monthly_metrics({ data_dir, shared_db, logs_db, archive_db, now: now() })
  } finally {
    shared_db?.close()
    logs_db?.close()
    archive_db?.close()
    summary.duration_ms = Math.round(performance.now() - started)
  }
  return summary
}

/**
 * Freeze any missing `monthly_metrics` row (see `monthly-metrics.ts`). Runs here
 * because this is already the daily niced off-thread moment and the retention
 * sweep has just finalized the previous month — so on the 1st the month is whole
 * before it is measured. A no-op on all other days.
 *
 * THE ONE PLACE THIS CHILD WRITES. Everything else it touches is read-only by
 * design, so the write is deliberately narrow: a separate short-lived handle,
 * opened directly rather than through `get_shared_db()` so the migration runner
 * still never fires in the child, used for a single small INSERT and closed.
 * Failure is swallowed into the summary — a missing month is recoverable next
 * run, a dead analytics child is not.
 */
function freeze_monthly_metrics({ data_dir, shared_db, logs_db, archive_db, now }: {
  data_dir: string
  shared_db: Database.Database
  logs_db: Database.Database
  archive_db: Database.Database | null
  now: Date
}): string[] {
  const months = missing_metric_months({ shared_db, now })
  if (!months.length)
    return []
  let writable: Database.Database | null = null
  try {
    writable = new SqliteDatabase(join(data_dir, 'shared.db'), { fileMustExist: true })
    writable.pragma('busy_timeout = 15000')
    const written: string[] = []
    for (const month of months) {
      const computed = performance.now()
      const metrics = compute_monthly_metrics({ month, shared_db, logs_db, archive_db, now })
      save_monthly_metrics({ shared_db: writable, metrics })
      written.push(month)
      console.info(`[analytics-snapshot] monthly_metrics ${month} computed in ${Math.round(performance.now() - computed)}ms (${metrics.site_visitors} visitors over ${metrics.days_counted}d).`)
    }
    return written
  } catch (error) {
    console.error('[analytics-snapshot] monthly_metrics failed:', error)
    return []
  } finally {
    writable?.close()
  }
}

// ── Parent side: spawning the child ─────────────────────────────────────────

/**
 * Turn the child's retention half into telemetry. The PARENT writes it — same
 * rule as the analytics half, and for the same reason: the child is a short-lived
 * process whose own `console` dies with the container.
 *
 * Until 2026-08-02 the sweep's ONLY success-path account of itself was a
 * `console.info`, which is why measuring its 115-second freeze took a
 * reverse-proxy log correlation by hand. A success path that emits nothing is
 * indistinguishable from a job that never ran.
 */
function report_retention_sweep({ reason, sweep_retention, summary }: {
  reason: string
  sweep_retention: boolean
  summary: SnapshotJobSummary | null
}): void {
  if (!sweep_retention)
    return
  const retention = summary?.retention
  if (!retention) {
    log_server_event({ level: 'error', message: 'log_retention_sweep_failed', context: { reason, detail: 'child exited without reporting a sweep' } })
    return
  }
  if (retention.error) {
    log_server_event({ level: 'error', message: 'log_retention_sweep_failed', context: { reason, ...retention } })
    return
  }
  log_server_event({ level: 'info', message: 'log_retention_swept', context: { reason, ...retention } })
}

/** Beyond this the compute is assumed wedged and the child is killed — a deadlock catcher, not a budget. */
const CHILD_TIMEOUT_MS = 20 * 60_000

/**
 * Nice 19: the child physically cannot outrank request serving on a 2-vCPU box.
 * Set by the child ON ITSELF — lowering priority needs no privileges, so this
 * works in the container without `nice` on PATH or a capability.
 */
const CHILD_NICE = 19

/**
 * Heap ceiling for the child. MEASURED (2026-07-30, living's 2.1 GB logs.db copied
 * to mustang): one 30-day payload peaks around 1.0 GB RSS, so this leaves real
 * headroom while still being bounded — an unexpected blow-up ends as a dead child
 * and a stale checkpoint, not as the OOM killer choosing between the child and the
 * server. The box has ~5.5 GB available. `peak_rss_mb` on every
 * `analytics_snapshot_computed` event is how we'd see this getting tight.
 */
const CHILD_MAX_HEAP_MB = 2048

/** In-flight guard, on `globalThis` so Vite HMR / repeated imports can't create a second one. */
const RUNNING_KEY = Symbol.for('living.analytics-snapshot.running')
interface RunningState { started_at: number, reason: string }
function running_state(): RunningState | null {
  return (globalThis as Record<symbol, unknown>)[RUNNING_KEY] as RunningState | null ?? null
}
function set_running(state: RunningState | null): void {
  (globalThis as Record<symbol, unknown>)[RUNNING_KEY] = state
}

export function analytics_snapshot_running(): boolean {
  return running_state() !== null
}

/** Test-only: drop the in-flight guard (a fake child never fires `exit`). */
export function _reset_analytics_snapshot_running_for_tests(): void {
  set_running(null)
}

export type SpawnOutcome = 'spawned' | 'already-running' | 'ran-inline' | 'failed'

/**
 * Fork the niced child. Returns immediately — callers (the daily cron, the boot
 * catch-up, the Recompute button) never await a compute.
 *
 * In DEV there is no bundle to fork (`import.meta.url` is a `.ts` path node can't
 * run) so the job runs inline; a dev machine's `.data` is tiny and nothing
 * health-checks a dev server.
 */
export async function spawn_analytics_snapshot_job({ reason, sweep_retention = false, fork_impl = fork, inline = dev }: {
  reason: string
  /** Have the child run the daily retention sweep before computing (cron only). */
  sweep_retention?: boolean
  /** Test seam. */
  fork_impl?: typeof fork
  /**
   * Run the job in THIS process instead of forking. Defaults to `dev`, where
   * there is no bundle to fork; tests set it false to exercise the fork call.
   */
  inline?: boolean
}): Promise<SpawnOutcome> {
  if (building)
    return 'failed'
  const running = running_state()
  if (running) {
    // The daily sweep rides this same guard: skipping it for a day is safe (the
    // rollup watermark makes it a catch-up next run), but it must be visible.
    console.info(`[analytics-snapshot] already running (${running.reason}, ${Math.round((Date.now() - running.started_at) / 1000)}s) — skipping ${reason}.`)
    if (sweep_retention)
      log_server_event({ level: 'warn', message: 'log_retention_sweep_skipped', context: { reason, running: running.reason, running_for_s: Math.round((Date.now() - running.started_at) / 1000) } })
    return 'already-running'
  }
  set_running({ started_at: Date.now(), reason })

  if (inline) {
    try {
      const summary = await run_analytics_snapshot_job({ reason, sweep_retention })
      report_retention_sweep({ reason, sweep_retention, summary })
      console.info(`[analytics-snapshot] inline run finished in ${summary.duration_ms}ms.`)
      return 'ran-inline'
    } catch (error) {
      console.error('[analytics-snapshot] inline run failed:', error)
      return 'failed'
    } finally {
      set_running(null)
    }
  }

  try {
    const child = fork_impl(fileURLToPath(import.meta.url), [], {
      env: { ...process.env, ANALYTICS_SNAPSHOT_CHILD: '1', ANALYTICS_SNAPSHOT_REASON: reason, ...(sweep_retention ? { ANALYTICS_SNAPSHOT_SWEEP: '1' } : {}) },
      execArgv: [`--max-old-space-size=${CHILD_MAX_HEAP_MB}`],
      // stdout/stderr ride the container log; `ipc` carries the summary home.
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    const timer = setTimeout(() => {
      console.error(`[analytics-snapshot] child ${child.pid} exceeded ${CHILD_TIMEOUT_MS}ms — killing.`)
      child.kill('SIGKILL')
    }, CHILD_TIMEOUT_MS)
    timer.unref()
    let summary: SnapshotJobSummary | null = null
    /**
     * Release the in-flight guard EXACTLY ONCE for this child.
     *
     * WHY THIS EXISTS (2026-07-30 nightly review, verified by running node — not
     * from the docs): node delivers `error` WITHOUT `exit` when a child fails to
     * LAUNCH (ENOENT and friends). The old code cleared the guard only in `exit`
     * and merely logged in `error`, so ONE launch failure left `running` set for
     * the life of the container — the 03:30 daily compute, the boot catch-up AND
     * the admin Recompute button all answered `already-running` forever after.
     * A launch failure is likeliest under memory/process pressure, i.e. exactly
     * when the dashboards matter.
     *
     * The `settled` latch is the other half: `error` CAN be followed by `exit`
     * (a child that spawned and then died), and a blind second `set_running(null)`
     * would clear the guard belonging to a LATER job that had already started.
     */
    let settled = false
    function settle(): boolean {
      if (settled)
        return false
      settled = true
      clearTimeout(timer)
      set_running(null)
      return true
    }
    child.on('message', (message) => {
      summary = message as SnapshotJobSummary
    })
    child.on('error', (error) => {
      console.error('[analytics-snapshot] child could not be spawned:', error)
      if (!settle())
        return
      log_server_event({
        level: 'warn',
        message: 'analytics_snapshot_failed',
        context: { reason, code: null, signal: null, spawn_error: (error as Error)?.message ?? String(error), written: [], failed: [] },
      })
      // A child that never launched never swept either. Node delivers `error`
      // WITHOUT `exit` in that case, so this cannot be left to the exit handler —
      // a day with no retention sweep must not pass silently.
      report_retention_sweep({ reason, sweep_retention, summary: null })
    })
    child.on('exit', (code, signal) => {
      if (!settle())
        return
      // The child stays read-only, so the PARENT owns the telemetry write.
      report_retention_sweep({ reason, sweep_retention, summary })
      if (code === 0 && summary) {
        log_server_event({
          level: 'info',
          message: 'analytics_snapshot_computed',
          context: { reason, duration_ms: summary.duration_ms, peak_rss_mb: summary.peak_rss_mb, written: summary.written, failed: summary.failed, pruned: summary.pruned },
        })
        return
      }
      log_server_event({
        level: 'warn',
        message: 'analytics_snapshot_failed',
        context: { reason, code, signal, written: summary?.written ?? [], failed: summary?.failed ?? [] },
      })
    })
    console.info(`[analytics-snapshot] spawned child ${child.pid} (${reason}) at nice ${CHILD_NICE}.`)
    return 'spawned'
  } catch (error) {
    set_running(null)
    console.error('[analytics-snapshot] spawn failed:', error)
    return 'failed'
  }
}

/**
 * Catch-up at boot — the ONE case where a daily checkpoint isn't enough: the very
 * first deploy of this feature (no file exists at all), or a box that was down
 * through its 03:30 window. Normal restarts do nothing: the files live on the
 * data volume and survive deploys, and a snapshot written at 03:30 is never 30 h
 * old before the next run.
 *
 * Unlike the boot warm-up it replaces, this holds up NOTHING — readiness, the
 * health check and the first requests are all indifferent to it, and the work
 * happens in a niced child well after the blue/green swap has settled.
 */
const CATCHUP_DELAY_MS = 3 * 60_000
const CATCHUP_MAX_AGE_MS = 30 * 60 * 60_000

export function start_analytics_snapshot_catchup(): void {
  // Dormant in dev + during the build, matching the crons: nothing health-checks a
  // dev server, and a svelte-look SSR render must not start scanning logs.db.
  if (dev || building)
    return
  // Blue/green: the primary owns background work (same rule as the cron scheduler).
  if (process.env.IS_STANDBY === 'true')
    return
  setTimeout(() => {
    const stale = snapshot_targets().filter((target) => {
      const snapshot = read_analytics_snapshot(target)
      return !snapshot || Date.now() - Date.parse(snapshot.generated_at) > CATCHUP_MAX_AGE_MS
    })
    if (!stale.length)
      return
    console.info(`[analytics-snapshot] ${stale.length} target(s) missing or >30h old at boot — computing.`)
    void spawn_analytics_snapshot_job({ reason: 'boot-catchup' })
  }, CATCHUP_DELAY_MS).unref()
}

// ── Child entry ────────────────────────────────────────────────────────────
// Reached ONLY by `spawn_analytics_snapshot_job` forking this chunk. In the
// server process the env var is absent and this is a single string comparison.

if (process.env.ANALYTICS_SNAPSHOT_CHILD === '1' && !building) {
  void (async () => {
    try {
      setPriority(0, CHILD_NICE)
    } catch (error) {
      console.warn('[analytics-snapshot] could not self-nice:', (error as Error).message)
    }
    try {
      const summary = await run_analytics_snapshot_job({
        reason: process.env.ANALYTICS_SNAPSHOT_REASON || 'cron',
        sweep_retention: process.env.ANALYTICS_SNAPSHOT_SWEEP === '1',
      })
      console.info(`[analytics-snapshot] child finished in ${summary.duration_ms}ms: ${summary.written.length} written, ${summary.failed.length} failed${summary.retention ? `, retention sweep ${summary.retention.duration_ms}ms` : ''}.`)
      const code = summary.failed.length ? 1 : 0
      // Exit from the send CALLBACK: the IPC write is not guaranteed synchronous,
      // and an immediate `process.exit()` can truncate the summary the parent logs.
      // The explicit exit is needed at all because an open IPC channel keeps the
      // event loop alive until the parent disconnects.
      if (process.send)
        process.send(summary, () => process.exit(code))
      else
        process.exit(code)
    } catch (error) {
      console.error('[analytics-snapshot] child failed:', error)
      process.exit(1)
    }
  })()
}
