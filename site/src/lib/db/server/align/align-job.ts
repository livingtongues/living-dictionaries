import type Database from 'better-sqlite3'
import type { DeriveResult } from './align-forms'
import type { TimestampedWord } from './align-runner'
import type { AlignConfig } from '$lib/db/schemas/shared.types'
import type { MediaTimings, SentenceToken, SentenceTokens } from '$lib/db/schemas/dictionary.types'
import type { TokenSpan } from '$lib/media/media-timings'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { dev } from '$app/environment'
import { ALIGN_JOB_STALE_AFTER_MS, R2_MEDIA_DOMAIN } from '$lib/constants'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'
import { encode_token_spans, unpack_timing_string } from '$lib/media/media-timings'
import { dev_media_dir } from '$lib/server/dev-media-dir'
import { log_server_event } from '$lib/server/log-server-event'
import { is_r2_media_path } from '$lib/utils/media-path'
import { get_dictionary_db } from '../dictionary-db'
import { get_dictionary_history_db } from '../dictionary-history-db'
import { get_shared_db } from '../shared-db'
import { update_media_timings } from '../v1-media-write'
import { mirror_dictionary_cursor } from '../v1-route-context'
import { derive_sentence_words } from './align-forms'
import { run_alignment } from './align-runner'

/**
 * Forced-alignment job orchestration (M6, `.issues/auto-align-timings.md`).
 * `request_align_job` derives align_forms SYNCHRONOUSLY (cheap — the caller
 * gets coverage numbers in the POST response), inserts a `running` align_jobs
 * row, then fires the actual alignment WITHOUT awaiting it: fetch audio →
 * aligner (Modal or local CPU, `align-runner.ts`) → re-encode the chained
 * per-sentence timing strings → `update_media_timings` (normal sync delivers
 * them to clients and karaoke lights up).
 *
 * LIFECYCLE: `running` means "a live process owns this". Execution is bounded
 * by `ALIGN_EXECUTION_DEADLINE_MS` in both backends; any `running` row older
 * than `ALIGN_JOB_STALE_AFTER_MS` lost its owner (deploy/restart/crash) and is
 * swept to `failed` before duplicate detection and on every status read, so an
 * audio can never be wedged at HTTP 409 and the browser always reaches a
 * terminal, retryable state.
 */

export const ALIGN_DICT_DAILY_LIMIT = 20
export const ALIGN_GLOBAL_DAILY_LIMIT = 200

export const ALIGN_JOB_EXPIRED_ERROR = `Alignment did not finish within ${Math.round(ALIGN_JOB_STALE_AFTER_MS / 60_000)} minutes (server restarted or the aligner stalled) — try again`

export class AlignRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface AlignJobRow {
  id: string
  dictionary_id: string
  target_kind: 'text' | 'sentence'
  target_id: string
  audio_id: string
  status: 'running' | 'done' | 'failed'
  error: string | null
  tokens_total: number | null
  tokens_aligned: number | null
  created_at: string
  finished_at: string | null
}

export interface ExpiredAlignJob {
  id: string
  dictionary_id: string
  audio_id: string
  created_at: string
}

/**
 * The ONE meaning of `running`: a live process owns this job. A row older than
 * `ALIGN_JOB_STALE_AFTER_MS` cannot have a live owner — both aligner backends
 * abort at `ALIGN_EXECUTION_DEADLINE_MS` and the terminal write follows
 * immediately — so it was interrupted (deploy/restart/crash) and is failed here
 * in ONE atomic UPDATE. Fresh `running` rows are untouched, which is what keeps
 * "one active job per audio" true. Exported (with injectable db/now) for tests.
 */
export function expire_stale_align_jobs({ db, now = Date.now() }: { db?: Database.Database, now?: number } = {}): ExpiredAlignJob[] {
  const shared = db ?? get_shared_db()
  const cutoff = new Date(now - ALIGN_JOB_STALE_AFTER_MS).toISOString()
  return shared.prepare(`
    UPDATE align_jobs SET status = 'failed', error = ?, finished_at = ?
    WHERE status = 'running' AND created_at < ?
    RETURNING id, dictionary_id, audio_id, created_at
  `).all(ALIGN_JOB_EXPIRED_ERROR, new Date(now).toISOString(), cutoff) as ExpiredAlignJob[]
}

/** Production path: recover interrupted jobs + record that it happened. */
function sweep_stale_align_jobs(): void {
  const expired = expire_stale_align_jobs()
  if (!expired.length)
    return
  log_server_event({ level: 'warn', message: 'align_job_expired', context: { count: expired.length, jobs: expired.slice(0, 20) } })
}

/** Duplicate detection — only a LIVE `running` row blocks a new request. */
export function has_running_align_job({ db, audio_id }: { db?: Database.Database, audio_id: string }): boolean {
  const shared = db ?? get_shared_db()
  return !!shared.prepare(`SELECT id FROM align_jobs WHERE audio_id = ? AND status = 'running'`).get(audio_id)
}

export function check_align_rate_limit(dictionary_id: string): void {
  const shared = get_shared_db()
  const today = `${new Date().toISOString().slice(0, 10)}%`
  const { dict_count } = shared.prepare(`SELECT COUNT(*) AS dict_count FROM align_jobs WHERE dictionary_id = ? AND created_at LIKE ?`).get(dictionary_id, today) as { dict_count: number }
  if (dict_count >= ALIGN_DICT_DAILY_LIMIT)
    throw new AlignRequestError(429, `Daily alignment limit reached for this dictionary (${ALIGN_DICT_DAILY_LIMIT}/day) — try again tomorrow`)
  const { global_count } = shared.prepare(`SELECT COUNT(*) AS global_count FROM align_jobs WHERE created_at LIKE ?`).get(today) as { global_count: number }
  if (global_count >= ALIGN_GLOBAL_DAILY_LIMIT)
    throw new AlignRequestError(429, `Daily alignment limit reached site-wide (${ALIGN_GLOBAL_DAILY_LIMIT}/day) — try again tomorrow`)
}

interface SentenceForAlign {
  sentence_id: string
  tokens: SentenceToken[]
}

function load_sentences({ db, target_kind, target_id }: { db: Database.Database, target_kind: 'text' | 'sentence', target_id: string }): SentenceForAlign[] {
  const rows = target_kind === 'text'
    ? db.prepare(`SELECT * FROM sentences WHERE text_id = ? ORDER BY sort_key`).all(target_id) as Record<string, unknown>[]
    : db.prepare(`SELECT * FROM sentences WHERE id = ?`).all(target_id) as Record<string, unknown>[]
  return rows
    .map((raw) => {
      const row = parse_dict_row('sentences', raw) as { id: string, tokens: SentenceTokens | null }
      return { sentence_id: row.id, tokens: row.tokens?.[PRIMARY_ORTHOGRAPHY_CODE] ?? [] }
    })
    .filter(sentence => sentence.tokens.length > 0)
}

function load_entries({ db, sentences }: { db: Database.Database, sentences: SentenceForAlign[] }) {
  const entry_ids = new Set<string>()
  for (const { tokens } of sentences) {
    for (const token of tokens) {
      if (token.entry_id)
        entry_ids.add(token.entry_id)
    }
  }
  const entries_by_id = new Map<string, { lexeme?: Record<string, string>, phonetic?: string | null }>()
  if (!entry_ids.size)
    return entries_by_id
  const ids = [...entry_ids]
  const rows = db.prepare(`SELECT id, lexeme, phonetic FROM entries WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Record<string, unknown>[]
  for (const raw of rows) {
    const row = parse_dict_row('entries', raw) as { id: string, lexeme?: Record<string, string>, phonetic?: string | null }
    entries_by_id.set(row.id, { lexeme: row.lexeme, phonetic: row.phonetic })
  }
  return entries_by_id
}

function audio_ref(storage_path: string) {
  if (!is_r2_media_path(storage_path))
    throw new Error('audio does not have a valid R2 media key')
  if (dev)
    return { path: resolve(dev_media_dir(), storage_path) }
  return { url: `${R2_MEDIA_DOMAIN}/${storage_path}` }
}

/**
 * Walk the aligner's flat word list back onto per-sentence token spans and
 * re-encode the chained per-sentence timing strings (offsets relative to the
 * end of the previous timed token ACROSS sentences). Clamps guard the chain:
 * a span never starts before the cursor and lasts at least 20ms (one CTC
 * frame). Sentences with no timed words are omitted. Exported for tests.
 */
export function build_media_timings({ sentences, timestamped }: {
  sentences: { sentence_id: string, words: { text: string }[] }[]
  timestamped: TimestampedWord[]
}): MediaTimings {
  const timings: MediaTimings = {}
  let chain_cursor = 0
  let flat_index = 0
  for (const sentence of sentences) {
    const sentence_start_cursor = chain_cursor
    const token_spans: (TokenSpan | undefined)[] = []
    for (let i = 0; i < sentence.words.length; i++, flat_index++) {
      const timed = timestamped[flat_index]
      if (timed && typeof timed.start_ms === 'number' && typeof timed.end_ms === 'number') {
        const start_ms = Math.max(timed.start_ms, chain_cursor)
        const end_ms = Math.max(timed.end_ms, start_ms + 20)
        token_spans.push({ start_ms, end_ms })
        chain_cursor = end_ms
      } else {
        token_spans.push(undefined)
      }
    }
    if (!token_spans.some(span => span))
      continue
    const { timing_string } = encode_token_spans({ token_spans, cursor_ms: sentence_start_cursor })
    timings[sentence.sentence_id] = timing_string
  }
  return timings
}

export interface RequestAlignJobResult {
  job: AlignJobRow
  coverage: Pick<DeriveResult, 'tokens_total' | 'tokens_aligned' | 'gap_forms'>
}

export function request_align_job({ dictionary_id, target_kind, target_id, audio_id, align_config, user_id, via }: {
  dictionary_id: string
  target_kind: 'text' | 'sentence'
  target_id: string
  audio_id: string
  align_config: AlignConfig | null | undefined
  user_id: string
  via: 'ui' | 'v1' | 'auto'
}): RequestAlignJobResult {
  if (!align_config)
    throw new AlignRequestError(400, 'Alignment is not configured for this dictionary — contact the Living Dictionaries team to set it up')

  const shared = get_shared_db()
  sweep_stale_align_jobs()
  if (has_running_align_job({ db: shared, audio_id }))
    throw new AlignRequestError(409, 'An alignment is already running for this audio')

  check_align_rate_limit(dictionary_id)

  const db = get_dictionary_db(dictionary_id)
  const link_column = target_kind === 'text' ? 'text_id' : 'sentence_id'
  const audio_row = db.prepare(`SELECT * FROM audio WHERE id = ? AND ${link_column} = ?`).get(audio_id, target_id) as { storage_path: string } | undefined
  if (!audio_row)
    throw new AlignRequestError(404, `audio not linked to this ${target_kind}`)

  const sentences = load_sentences({ db, target_kind, target_id })
  if (!sentences.length)
    throw new AlignRequestError(400, 'No tokenized sentences to align')

  const entries_by_id = load_entries({ db, sentences })
  const derived = derive_sentence_words({ sentences, entries_by_id, config: align_config })
  if (!derived.tokens_aligned)
    throw new AlignRequestError(400, 'No tokens could be romanized with the current alignment configuration')

  const now = new Date().toISOString()
  const job: AlignJobRow = {
    id: randomUUID(),
    dictionary_id,
    target_kind,
    target_id,
    audio_id,
    status: 'running',
    error: null,
    tokens_total: derived.tokens_total,
    tokens_aligned: derived.tokens_aligned,
    created_at: now,
    finished_at: null,
  }
  shared.prepare(`
    INSERT INTO align_jobs (id, dictionary_id, target_kind, target_id, audio_id, status, tokens_total, tokens_aligned, requested_by_user_id, requested_via, created_at)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
  `).run(job.id, dictionary_id, target_kind, target_id, audio_id, derived.tokens_total, derived.tokens_aligned, user_id, via, now)

  void execute_align_job({ job, derived, storage_path: audio_row.storage_path, user_id })

  return { job, coverage: { tokens_total: derived.tokens_total, tokens_aligned: derived.tokens_aligned, gap_forms: derived.gap_forms } }
}

async function execute_align_job({ job, derived, storage_path, user_id }: {
  job: AlignJobRow
  derived: DeriveResult
  storage_path: string
  user_id: string
}): Promise<void> {
  const shared = get_shared_db()
  try {
    const flat_words = derived.sentences.flatMap(sentence => sentence.words)
    const timestamped = await run_alignment({ audio: audio_ref(storage_path), words: flat_words })
    if (timestamped.length !== flat_words.length)
      throw new Error(`aligner returned ${timestamped.length} words for ${flat_words.length} sent`)

    const timings = build_media_timings({ sentences: derived.sentences, timestamped })
    if (!Object.keys(timings).length)
      throw new Error('aligner produced no timed words')

    const db = get_dictionary_db(job.dictionary_id)
    const result = update_media_timings({
      db,
      history_db: get_dictionary_history_db(job.dictionary_id),
      cell_key: job.target_kind === 'text' ? 'audio:text' : 'audio:sentence',
      owner_id: job.target_id,
      media_id: job.audio_id,
      timings,
      user_id,
    })
    if (!result.found)
      throw new Error('audio no longer linked to target')
    mirror_dictionary_cursor({ dict_id: job.dictionary_id, cursor: result.new_synced_up_to })

    shared.prepare(`UPDATE align_jobs SET status = 'done', finished_at = ? WHERE id = ?`).run(new Date().toISOString(), job.id)
    log_server_event({ level: 'info', message: 'align_job_done', user_id, context: { dictionary_id: job.dictionary_id, job_id: job.id, target_kind: job.target_kind, target_id: job.target_id, tokens_total: job.tokens_total, tokens_aligned: job.tokens_aligned } })
  } catch (err) {
    const message = (err as Error).message?.slice(0, 1000) ?? 'unknown error'
    shared.prepare(`UPDATE align_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`).run(message, new Date().toISOString(), job.id)
    log_server_event({ level: 'error', message: 'align_job_failed', user_id, error: err, context: { dictionary_id: job.dictionary_id, job_id: job.id } })
  }
}

/**
 * Status read for the polling browser/agent. Sweeps first so a job whose owner
 * died reports `failed` (retryable) instead of `running` forever.
 */
export function get_align_job({ job_id, dictionary_id }: { job_id: string, dictionary_id: string }): AlignJobRow | undefined {
  sweep_stale_align_jobs()
  return get_shared_db().prepare(`SELECT id, dictionary_id, target_kind, target_id, audio_id, status, error, tokens_total, tokens_aligned, created_at, finished_at FROM align_jobs WHERE id = ? AND dictionary_id = ?`).get(job_id, dictionary_id) as AlignJobRow | undefined
}

if (import.meta.vitest) {
  describe(build_media_timings, () => {
    test('chains offsets across sentences and leaves punctuation/gaps untimed', () => {
      const timings = build_media_timings({
        sentences: [
          { sentence_id: 's1', words: [{ text: 'a' }, { text: ',' }, { text: 'b' }] },
          { sentence_id: 's2', words: [{ text: 'c' }] },
        ],
        timestamped: [
          { text: 'a', start_ms: 100, end_ms: 300 },
          { text: ',' },
          { text: 'b', start_ms: 350, end_ms: 600 },
          { text: 'c', start_ms: 700, end_ms: 950 },
        ],
      })
      expect(timings).toEqual({ s1: '100,200||50,250', s2: '100,250' })
      // decode round-trip reproduces the absolute spans
      const s1 = unpack_timing_string({ timing_string: timings.s1, cursor_ms: 0 })
      expect(s1.spans).toEqual([{ start_ms: 100, end_ms: 300 }, undefined, { start_ms: 350, end_ms: 600 }])
      const s2 = unpack_timing_string({ timing_string: timings.s2, cursor_ms: s1.cursor_ms })
      expect(s2.spans).toEqual([{ start_ms: 700, end_ms: 950 }])
    })

    test('clamps out-of-order spans so the chain never goes backwards', () => {
      const timings = build_media_timings({
        sentences: [{ sentence_id: 's1', words: [{ text: 'a' }, { text: 'b' }] }],
        timestamped: [
          { text: 'a', start_ms: 100, end_ms: 300 },
          { text: 'b', start_ms: 250, end_ms: 260 }, // starts before previous end
        ],
      })
      const { spans } = unpack_timing_string({ timing_string: timings.s1, cursor_ms: 0 })
      expect(spans).toEqual([
        { start_ms: 100, end_ms: 300 },
        { start_ms: 300, end_ms: 320 }, // clamped to cursor + 20ms floor
      ])
    })

    test('omits sentences with no timed words without breaking the chain', () => {
      const timings = build_media_timings({
        sentences: [
          { sentence_id: 's1', words: [{ text: 'a' }] },
          { sentence_id: 'gap', words: [{ text: '文' }] },
          { sentence_id: 's2', words: [{ text: 'b' }] },
        ],
        timestamped: [
          { text: 'a', start_ms: 0, end_ms: 100 },
          { text: '文' },
          { text: 'b', start_ms: 500, end_ms: 800 },
        ],
      })
      expect(Object.keys(timings)).toEqual(['s1', 's2'])
      expect(timings.s2).toBe('400,300')
    })
  })
}
