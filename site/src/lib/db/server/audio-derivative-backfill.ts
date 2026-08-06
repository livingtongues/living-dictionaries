import type Database from 'better-sqlite3'
import { spawnSync } from 'node:child_process'
import { setPriority } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import SqliteDatabase from 'better-sqlite3'
import { building } from '$app/environment'
import { generate_and_store_audio_derivative } from '$lib/server/audio-derivative'
import { audio_playback_key } from '$lib/utils/media-path'
import { dictionary_db_path } from './dictionary-db'

/**
 * THE audio playback-derivative BACKFILL — the work itself, and the entry point
 * of the CHILD PROCESS that runs it. The parent half (forking, IPC, the ledger
 * writes, the telemetry) lives in `audio-derivative-sweep.ts`.
 *
 * WHY THIS IS ITS OWN FILE, and why the parent reaches it through a DYNAMIC
 * import: the child is spawned by forking the BUNDLED CHUNK that contains this
 * module, because the Docker runner ships no `.ts` files (the same trick as
 * `analytics-snapshot.ts`). That only works if this module gets a chunk of its
 * OWN. When the job lived beside the parent — which the cron roster imports, and
 * the roster is imported by `hooks.server.ts` — rollup folded it into the HOOKS
 * chunk, whose module body calls `start_crons_once()`. Forking that would have
 * started a second cron scheduler inside every backfill child. A dynamic import
 * is what guarantees the split; `BACKFILL_MODULE_URL` is how the parent learns
 * the resulting path.
 *
 * CONSEQUENCES of re-entering through a chunk, both load-bearing:
 *  - `$env/dynamic/private` is EMPTY in the child (it is populated by
 *    `Server.init()` in `build/index.js`, which the child never runs), so
 *    `r2-media.ts` falls back to `process.env` for its credentials.
 *  - The child must never call `get_shared_db()` — that would run migrations.
 *    It opens shared.db READ-ONLY and reports every object it stores back over
 *    IPC so the PARENT writes the `media_objects` ledger row.
 */

/** The bundled chunk this module lives in — the thing the parent forks. */
export const BACKFILL_MODULE_URL = import.meta.url

/** Ignore clips younger than this — the upload path's own conversion is probably still running. */
const MIN_AGE_MS = 60_000
/** A clip uploaded within this window is re-checked for a STALE derivative (timings edited after conversion). */
const REPAIR_WINDOW_MS = 24 * 60 * 60 * 1000
/** Hard ceiling on conversions per daily run. The upload path does the steady-state work. */
const MAX_PER_RUN = 2000
/** Wall-clock budget — a run can never bleed into the next day's. */
const MAX_RUN_MS = 60 * 60_000
/** Simultaneous ffmpeg pipelines in the child (each is itself a `nice -n 19` subprocess). */
const MAX_CONCURRENCY = 2

export interface AudioDerivativeSummary {
  /** Audio originals considered (the whole ledger scan). */
  scanned: number
  /** Originals with no derivative, or with one older than a timing edit. */
  candidates: number
  generated: number
  failed: number
  /** Hit `MAX_PER_RUN` / `MAX_RUN_MS` — there is more to do tomorrow. */
  truncated: boolean
  duration_ms: number
  step_ms: { ledger_scan: number, dict_lookups: number, convert: number }
  convert_ms: { p50: number | null, p90: number | null }
  bytes_out: number
  /** First few failures, for the log event — never the whole list. */
  errors: { key: string, message: string }[]
}

export interface LedgerMessage { type: 'ledger', key: string, bytes: number, duration_ms: number | null }
export interface SummaryMessage { type: 'summary', summary: AudioDerivativeSummary }
export type ChildMessage = LedgerMessage | SummaryMessage

// ── The work (runs in the CHILD, or inline in dev) ──────────────────────────

interface Candidate { key: string, dict_id: string, trim: boolean }

/**
 * Which originals still need a derivative. ONE pass over the audio rows of the
 * ledger plus one over the variant rows, diffed in JS — instead of a correlated
 * join on a computed key. ~300k short strings is nothing in a child process and
 * everything on a request thread.
 */
function find_candidates({ shared_db, now }: { shared_db: Database.Database, now: number }): {
  scanned: number
  missing: { key: string, dict_id: string }[]
  recent: { key: string, dict_id: string, derivative_uploaded_at: string }[]
} {
  const cutoff = new Date(now - MIN_AGE_MS).toISOString()
  const recent_cutoff = new Date(now - REPAIR_WINDOW_MS).toISOString()
  const originals = shared_db.prepare(`
    SELECT key, dict_id, uploaded_at FROM media_objects
    WHERE media_type = 'audio' AND is_variant = 0 AND uploaded_at < ?
    ORDER BY uploaded_at
  `).all(cutoff) as { key: string, dict_id: string, uploaded_at: string }[]
  const derivatives = new Map((shared_db.prepare(`
    SELECT key, uploaded_at FROM media_objects WHERE media_type = 'audio' AND is_variant = 1
  `).all() as { key: string, uploaded_at: string }[]).map(row => [row.key, row.uploaded_at]))

  const missing: { key: string, dict_id: string }[] = []
  const recent: { key: string, dict_id: string, derivative_uploaded_at: string }[] = []
  for (const original of originals) {
    const derivative_uploaded_at = derivatives.get(audio_playback_key({ original_key: original.key }))
    if (derivative_uploaded_at === undefined)
      missing.push({ key: original.key, dict_id: original.dict_id })
    else if (original.uploaded_at >= recent_cutoff)
      recent.push({ key: original.key, dict_id: original.dict_id, derivative_uploaded_at })
  }
  return { scanned: originals.length, missing, recent }
}

/**
 * Decide `trim` (and, for the repair set, whether the derivative is stale) by
 * asking each dictionary's own DB about its `audio` rows. Grouped by dictionary
 * so every file is opened ONCE per run — the old code opened one per candidate
 * row, up to 160 times every five minutes.
 */
function resolve_candidates({ missing, recent }: {
  missing: { key: string, dict_id: string }[]
  recent: { key: string, dict_id: string, derivative_uploaded_at: string }[]
}): Candidate[] {
  const by_dictionary = new Map<string, { keys: string[], derivative_uploaded_at: Map<string, string> }>()
  function add({ key, dict_id, derivative_uploaded_at }: { key: string, dict_id: string, derivative_uploaded_at?: string }): void {
    const group = by_dictionary.get(dict_id) ?? { keys: [], derivative_uploaded_at: new Map<string, string>() }
    group.keys.push(key)
    if (derivative_uploaded_at !== undefined)
      group.derivative_uploaded_at.set(key, derivative_uploaded_at)
    by_dictionary.set(dict_id, group)
  }
  for (const row of missing) add(row)
  for (const row of recent) add(row)

  const candidates: Candidate[] = []
  for (const [dict_id, group] of by_dictionary) {
    let db: Database.Database
    try {
      db = new SqliteDatabase(dictionary_db_path(dict_id), { readonly: true, fileMustExist: true })
    } catch {
      continue // dictionary deleted, or its file never existed — the media sweep owns those orphans
    }
    try {
      // Chunked IN (...) — SQLite's default variable limit is 32,766.
      for (let index = 0; index < group.keys.length; index += 500) {
        const chunk = group.keys.slice(index, index + 500)
        const rows = db.prepare(`
          SELECT storage_path, sentence_id, text_id, timings, updated_at FROM audio
          WHERE storage_path IN (${chunk.map(() => '?').join(',')})
        `).all(...chunk) as { storage_path: string, sentence_id: string | null, text_id: string | null, timings: string | null, updated_at: string }[]
        for (const row of rows) {
          // A clip attached to a sentence/text, or carrying word timings, must
          // keep its original head/tail — trimming silence would slide every
          // alignment offset. Those are also the ones an edit can invalidate.
          const must_be_untrimmed = Boolean(row.sentence_id || row.text_id || row.timings)
          const existing = group.derivative_uploaded_at.get(row.storage_path)
          if (existing !== undefined && !(must_be_untrimmed && existing < row.updated_at))
            continue
          candidates.push({ key: row.storage_path, dict_id, trim: !must_be_untrimmed })
        }
      }
    } finally {
      db.close()
    }
  }
  return candidates
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length)
    return null
  const sorted = [...values].sort((first, second) => first - second)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))])
}

/** Convert `candidates` with a fixed-size pool, reporting each stored object as it lands. */
async function convert_all({ candidates, deadline, report }: {
  candidates: Candidate[]
  deadline: number
  report: (message: LedgerMessage) => void
}): Promise<Pick<AudioDerivativeSummary, 'generated' | 'failed' | 'bytes_out' | 'errors'> & { convert_ms: number[], truncated: boolean }> {
  const result = { generated: 0, failed: 0, bytes_out: 0, errors: [] as { key: string, message: string }[], convert_ms: [] as number[], truncated: false }
  let next = 0
  async function worker(): Promise<void> {
    while (next < candidates.length) {
      if (Date.now() > deadline) {
        result.truncated = true
        return
      }
      const candidate = candidates[next++]
      const started = performance.now()
      try {
        const stored = await generate_and_store_audio_derivative({ original_key: candidate.key, trim: candidate.trim, record_in_ledger: false })
        result.generated++
        result.bytes_out += stored.bytes
        report({ type: 'ledger', key: stored.key, bytes: stored.bytes, duration_ms: stored.duration_ms })
      } catch (error) {
        result.failed++
        if (result.errors.length < 5)
          result.errors.push({ key: candidate.key, message: (error as Error).message.slice(0, 300) })
      }
      result.convert_ms.push(performance.now() - started)
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENCY }, () => worker()))
  return result
}

/** The read-only half: open shared.db, find what needs converting, close it again. */
function scan({ now }: { now: number }): { scanned: number, candidates: Candidate[], scan_ms: number, lookup_ms: number } {
  const shared_db = new SqliteDatabase(join(process.env.DATA_DIR || '.data', 'shared.db'), { readonly: true, fileMustExist: true })
  shared_db.pragma('busy_timeout = 5000')
  try {
    const scan_started = performance.now()
    const found = find_candidates({ shared_db, now })
    const scan_ms = performance.now() - scan_started
    const lookup_started = performance.now()
    const candidates = resolve_candidates(found)
    return { scanned: found.scanned, candidates, scan_ms, lookup_ms: performance.now() - lookup_started }
  } finally {
    shared_db.close()
  }
}

/**
 * The whole job. Runs in the CHILD (and inline in dev, where there is no bundle
 * to fork). Opens shared.db READ-ONLY — the ledger writes happen in the parent.
 */
export async function run_audio_derivative_backfill({ report, now = Date.now() }: {
  report: (message: LedgerMessage) => void
  now?: number
}): Promise<AudioDerivativeSummary> {
  const started = performance.now()
  const deadline = now + MAX_RUN_MS
  const { scanned, candidates, scan_ms, lookup_ms } = scan({ now })

  const capped = candidates.slice(0, MAX_PER_RUN)
  const convert_started = performance.now()
  const converted = await convert_all({ candidates: capped, deadline, report })
  return {
    scanned,
    candidates: candidates.length,
    generated: converted.generated,
    failed: converted.failed,
    truncated: converted.truncated || candidates.length > capped.length,
    duration_ms: Math.round(performance.now() - started),
    step_ms: {
      ledger_scan: Math.round(scan_ms),
      dict_lookups: Math.round(lookup_ms),
      convert: Math.round(performance.now() - convert_started),
    },
    convert_ms: { p50: percentile(converted.convert_ms, 0.5), p90: percentile(converted.convert_ms, 0.9) },
    bytes_out: converted.bytes_out,
    errors: converted.errors,
  }
}

// ── Child entry ────────────────────────────────────────────────────────────
// Reached ONLY by `run_audio_derivative_sweep` forking this chunk. In the server
// process the env var is absent and this is a single string comparison.

/** Nice 19: the child physically cannot outrank request serving on a 2-vCPU box. */
export const CHILD_NICE = 19
/** Idle I/O class — the job is mostly R2 transfers and temp-file writes. */
export const CHILD_IONICE_CLASS = 3

if (process.env.AUDIO_DERIVATIVE_CHILD === '1' && !building) {
  void (async () => {
    try {
      setPriority(0, CHILD_NICE)
    } catch (error) {
      console.warn('[audio-derivative] could not self-nice:', (error as Error).message)
    }
    const ionice = spawnSync('ionice', ['-c', String(CHILD_IONICE_CLASS), '-p', String(process.pid)], { stdio: 'ignore' })
    if (ionice.error || ionice.status !== 0)
      console.warn('[audio-derivative] could not self-ionice:', ionice.error?.message ?? `exit ${ionice.status}`)
    try {
      const summary = await run_audio_derivative_backfill({
        report: message => process.send?.(message),
      })
      // Exit from the send CALLBACK: the IPC write is not guaranteed synchronous
      // and an immediate exit can truncate the summary the parent logs.
      if (process.send)
        process.send({ type: 'summary', summary } satisfies SummaryMessage, () => process.exit(0))
      else
        process.exit(0)
    } catch (error) {
      console.error('[audio-derivative] child failed:', error)
      process.exit(1)
    }
  })()
}
