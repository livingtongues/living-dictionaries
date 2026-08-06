import type { LedgerMessage } from './audio-derivative-backfill'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { write_dev_media } from '$lib/server/dev-media-dir'
import { run_audio_derivative_backfill } from './audio-derivative-backfill'

/**
 * End-to-end for the daily backfill: a real ffmpeg encode of a real (synthesized)
 * audio file, out of the dev-media store and back into it, driven only by what
 * the two databases say. Guards the two things the 2026-08-04 rewrite changed —
 * that a missing derivative is found without a computed-key join, and that a
 * timing-sensitive clip edited after its conversion is REGENERATED UNTRIMMED.
 */

const UNTOUCHED = '11111111-1111-1111-1111-111111111111'
const MISSING = '22222222-2222-2222-2222-222222222222'
const STALE_TIMED = '33333333-3333-3333-3333-333333333333'

let data_dir: string
let previous_data_dir: string | undefined

function key(id: string): string {
  return `tdict/audio/${id}.mp3`
}

function seed(): void {
  const shared = new Database(join(data_dir, 'shared.db'))
  shared.exec(`CREATE TABLE media_objects (
    key TEXT PRIMARY KEY, dict_id TEXT NOT NULL, media_type TEXT NOT NULL,
    is_variant INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL, uploaded_at TEXT NOT NULL,
    duration_ms INTEGER, width INTEGER, height INTEGER)`)
  const insert = shared.prepare('INSERT INTO media_objects (key, dict_id, media_type, is_variant, bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)')
  const old = '2026-01-01T00:00:00.000Z'
  const recent = new Date(Date.now() - 2 * 3600_000).toISOString()
  insert.run(key(UNTOUCHED), 'tdict', 'audio', 0, 1000, old)
  insert.run(key(UNTOUCHED).replace('.mp3', '_p1.mp3'), 'tdict', 'audio', 1, 500, '2026-01-02T00:00:00.000Z')
  insert.run(key(MISSING), 'tdict', 'audio', 0, 1000, old)
  // Uploaded recently AND its derivative predates the row's `updated_at` → repair.
  insert.run(key(STALE_TIMED), 'tdict', 'audio', 0, 1000, recent)
  insert.run(key(STALE_TIMED).replace('.mp3', '_p1.mp3'), 'tdict', 'audio', 1, 500, '2026-01-02T00:00:00.000Z')
  shared.close()

  mkdirSync(join(data_dir, 'dictionaries'), { recursive: true })
  const dict = new Database(join(data_dir, 'dictionaries', 'tdict.db'))
  dict.exec(`CREATE TABLE audio (id TEXT PRIMARY KEY, sentence_id TEXT, text_id TEXT,
    storage_path TEXT NOT NULL, timings TEXT, updated_at TEXT NOT NULL)`)
  const add = dict.prepare('INSERT INTO audio (id, sentence_id, text_id, storage_path, timings, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  add.run('a1', null, null, key(UNTOUCHED), null, old)
  add.run('a2', null, null, key(MISSING), null, old)
  add.run('a3', 's1', null, key(STALE_TIMED), '0,1.2', '2026-01-03T00:00:00.000Z')
  dict.close()
}

/** One second of a 440 Hz tone with silence on both ends, so trimming is observable. */
function write_source_audio(id: string): void {
  const file = join(data_dir, `${id}.mp3`)
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1',
    // 0.4 s of silence either side of the tone — what the trimmer removes.
    '-af', 'adelay=400,apad=pad_dur=0.4',
    '-t', '1.8', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '4', file,
  ], { timeout: 30_000 })
  write_dev_media({ key: key(id), content: readFileSync(file) })
  rmSync(file, { force: true })
}

describe(run_audio_derivative_backfill, () => {
  beforeEach(() => {
    data_dir = mkdtempSync(join(tmpdir(), 'ld-audio-backfill-'))
    previous_data_dir = process.env.DATA_DIR
    process.env.DATA_DIR = data_dir
    seed()
    write_source_audio(MISSING)
    write_source_audio(STALE_TIMED)
  })

  afterEach(() => {
    if (previous_data_dir === undefined)
      delete process.env.DATA_DIR
    else
      process.env.DATA_DIR = previous_data_dir
    rmSync(data_dir, { recursive: true, force: true })
  })

  test('converts exactly the clips that need it, and reports each stored object for the parent to ledger', async () => {
    const reported: LedgerMessage[] = []
    const summary = await run_audio_derivative_backfill({ report: message => reported.push(message) })

    expect(summary.scanned).toBe(3)
    expect(summary.candidates).toBe(2)
    expect(summary.generated).toBe(2)
    expect(summary.failed).toBe(0)
    expect(summary.errors).toEqual([])
    expect(summary.truncated).toBeFalsy()
    // The clip whose derivative is already current is NOT re-encoded.
    expect(reported.map(message => message.key).sort()).toEqual([
      key(MISSING).replace('.mp3', '_p1.mp3'),
      key(STALE_TIMED).replace('.mp3', '_p1.mp3'),
    ].sort())
    for (const message of reported) {
      expect(message.type).toBe('ledger')
      expect(message.bytes).toBeTruthy()
      expect(message.duration_ms).toBeTruthy()
    }
    expect(summary.bytes_out).toBe(reported.reduce((sum, message) => sum + message.bytes, 0))
  }, 60_000)

  test('keeps a timing-carrying clip UNTRIMMED so its word offsets still line up', async () => {
    const reported: LedgerMessage[] = []
    await run_audio_derivative_backfill({ report: message => reported.push(message) })
    const timed = reported.find(message => message.key.includes(STALE_TIMED))
    const plain = reported.find(message => message.key.includes(MISSING))
    // Same 1.8 s source; the untimed one loses its 0.8 s of leading/trailing
    // silence. A genuine range check — mp3 frame alignment makes the exact
    // millisecond non-deterministic.
    // eslint-disable-next-line no-restricted-syntax
    expect(timed?.duration_ms).toBeGreaterThan((plain?.duration_ms ?? 0) + 300)
  }, 60_000)
})
