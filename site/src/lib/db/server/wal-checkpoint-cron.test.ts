import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { checkpoint_wal, run_wal_checkpoint_once } from './wal-checkpoint-cron'

let dir: string
let db: Database.Database

function wal_size(path: string): number {
  try {
    return statSync(`${path}-wal`).size
  } catch {
    return 0
  }
}

/** Grow the WAL by writing many rows with checkpointing suppressed. */
function bloat_wal(database: Database.Database): void {
  database.pragma('wal_autocheckpoint = 0') // stop the auto-checkpoint so the -wal actually grows
  database.exec('CREATE TABLE IF NOT EXISTS blob_rows (id INTEGER PRIMARY KEY, payload TEXT)')
  const insert = database.prepare('INSERT INTO blob_rows (payload) VALUES (?)')
  const write = database.transaction(() => {
    for (let i = 0; i < 2000; i++)
      insert.run('x'.repeat(4096))
  })
  write()
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wal-checkpoint-'))
  db = new BetterSqlite3(join(dir, 'test.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
})

afterEach(() => {
  try { db.close() } catch { /* already closed */ }
  rmSync(dir, { recursive: true, force: true })
})

describe(checkpoint_wal, () => {
  test('TRUNCATE checkpoint reclaims the -wal file back to (near) zero bytes', () => {
    bloat_wal(db)
    const before = wal_size(db.name)
    // eslint-disable-next-line no-restricted-syntax -- genuine "the WAL grew" precondition, not a magnitude assertion
    expect(before).toBeGreaterThan(1024 * 1024) // multi-MB WAL now exists

    const result = checkpoint_wal({ db, name: 'test.db' })

    expect(result.busy).toBe(0)
    expect(result.checkpointed_frames).toBe(result.log_frames)
    expect(result.wal_bytes_before).toBe(before)
    expect(result.wal_bytes_after).toBe(0) // TRUNCATE shrinks the file to zero
    expect(wal_size(db.name)).toBe(0)
  })

  test('reports busy without throwing when a second connection pins the WAL', () => {
    bloat_wal(db)
    db.pragma('busy_timeout = 100') // don't sit the whole test's worth waiting on the pinning reader
    // A concurrent reader with an OPEN transaction pins the WAL: TRUNCATE can't
    // fully drain, so SQLite reports busy=1 rather than truncating.
    const reader = new BetterSqlite3(db.name)
    reader.pragma('busy_timeout = 100')
    reader.exec('BEGIN')
    reader.prepare('SELECT COUNT(*) FROM blob_rows').get() // acquire the read snapshot

    const result = checkpoint_wal({ db, name: 'test.db' })
    expect(result.busy).toBe(1)
    // eslint-disable-next-line no-restricted-syntax -- genuine "not truncated" range check
    expect(result.wal_bytes_after).toBeGreaterThan(0)

    reader.exec('COMMIT')
    reader.close()
  })
})

describe(run_wal_checkpoint_once, () => {
  test('checkpoints every supplied DB and returns a result per file', () => {
    bloat_wal(db)
    const results = run_wal_checkpoint_once({ dbs: [{ db, name: 'test.db' }] })
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('test.db')
    expect(results[0].wal_bytes_after).toBe(0)
  })
})
