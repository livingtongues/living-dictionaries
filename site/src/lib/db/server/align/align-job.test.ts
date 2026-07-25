import type Database from 'better-sqlite3'
import { ALIGN_JOB_STALE_AFTER_MS } from '$lib/constants'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_test_shared_db } from '../shared-db'
import { ALIGN_JOB_EXPIRED_ERROR, expire_stale_align_jobs, has_running_align_job } from './align-job'

/**
 * Job LIFECYCLE law (the July 24 review's B1): a `running` row means a live
 * process owns the work. Interruption (deploy/restart/crash) or a backend that
 * never settles must resolve to a terminal, retryable state instead of wedging
 * that audio at HTTP 409 forever — while a genuinely live job still blocks a
 * second run on the same audio.
 */

const NOW = Date.parse('2026-07-25T12:00:00.000Z')
let db: Database.Database

function add_job({ id, audio_id = 'aud-1', status = 'running', age_ms = 0, dictionary_id = 'dict-1' }: {
  id: string
  audio_id?: string
  status?: 'running' | 'done' | 'failed'
  age_ms?: number
  dictionary_id?: string
}) {
  db.prepare(`
    INSERT INTO align_jobs (id, dictionary_id, target_kind, target_id, audio_id, status, tokens_total, tokens_aligned, requested_via, created_at, finished_at)
    VALUES (?, ?, 'sentence', 'sent-1', ?, ?, 10, 10, 'ui', ?, ?)
  `).run(id, dictionary_id, audio_id, status, new Date(NOW - age_ms).toISOString(), status === 'running' ? null : new Date(NOW - age_ms).toISOString())
}

function status_of(id: string) {
  return db.prepare('SELECT status, error, finished_at FROM align_jobs WHERE id = ?').get(id) as { status: string, error: string | null, finished_at: string | null }
}

beforeEach(() => { db = open_test_shared_db() })
afterEach(() => db.close())

describe(expire_stale_align_jobs, () => {
  test('fails an interrupted job whose owner outlived the deadline, and reports it', () => {
    add_job({ id: 'stale', age_ms: ALIGN_JOB_STALE_AFTER_MS + 1000 })

    const expired = expire_stale_align_jobs({ db, now: NOW })

    expect(expired).toHaveLength(1)
    expect(expired[0].id).toBe('stale')
    expect(expired[0].audio_id).toBe('aud-1')
    const row = status_of('stale')
    expect(row.status).toBe('failed')
    expect(row.error).toBe(ALIGN_JOB_EXPIRED_ERROR)
    expect(row.finished_at).toBe(new Date(NOW).toISOString())
  })

  test('leaves a live job, and already-terminal rows, alone', () => {
    add_job({ id: 'live', age_ms: ALIGN_JOB_STALE_AFTER_MS - 1000 })
    add_job({ id: 'old_done', status: 'done', age_ms: ALIGN_JOB_STALE_AFTER_MS * 10 })
    add_job({ id: 'old_failed', status: 'failed', age_ms: ALIGN_JOB_STALE_AFTER_MS * 10 })

    expect(expire_stale_align_jobs({ db, now: NOW })).toEqual([])
    expect(status_of('live').status).toBe('running')
    expect(status_of('old_done').status).toBe('done')
    expect(status_of('old_failed').error).toBe(null)
  })

  test('is idempotent — a second sweep has nothing left to expire', () => {
    add_job({ id: 'stale', age_ms: ALIGN_JOB_STALE_AFTER_MS + 1000 })

    expect(expire_stale_align_jobs({ db, now: NOW })).toHaveLength(1)
    expect(expire_stale_align_jobs({ db, now: NOW })).toEqual([])
  })
})

describe(has_running_align_job, () => {
  test('an interrupted job blocks the audio until the sweep, then frees it', () => {
    add_job({ id: 'stale', age_ms: ALIGN_JOB_STALE_AFTER_MS + 1000 })
    expect(has_running_align_job({ db, audio_id: 'aud-1' })).toBeTruthy()

    expire_stale_align_jobs({ db, now: NOW })

    expect(has_running_align_job({ db, audio_id: 'aud-1' })).toBeFalsy()
  })

  test('one active job per audio survives the sweep', () => {
    add_job({ id: 'stale', age_ms: ALIGN_JOB_STALE_AFTER_MS + 1000 })
    add_job({ id: 'live', age_ms: 5000 })
    add_job({ id: 'other_audio', audio_id: 'aud-2', age_ms: 5000 })

    expire_stale_align_jobs({ db, now: NOW })

    expect(has_running_align_job({ db, audio_id: 'aud-1' })).toBeTruthy()
    expect(status_of('live').status).toBe('running')
    expect(has_running_align_job({ db, audio_id: 'aud-2' })).toBeTruthy()
    expect(has_running_align_job({ db, audio_id: 'aud-3' })).toBeFalsy()
  })
})
