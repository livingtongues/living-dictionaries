import { gzipSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { decode_snapshot_bytes } from './fetch-snapshot'

const SQLITE_HEADER = new TextEncoder().encode('SQLite format 3\0')

function fake_sqlite_db(): Uint8Array {
  const bytes = new Uint8Array(100)
  bytes.set(SQLITE_HEADER, 0)
  return bytes
}

describe(decode_snapshot_bytes, () => {
  test('inflates opaque gzip bytes (the R2 form — no Content-Encoding on the object)', async () => {
    const db = fake_sqlite_db()
    const decoded = await decode_snapshot_bytes(new Uint8Array(gzipSync(db)))
    expect(decoded).toEqual(db)
  })

  test('passes raw SQLite bytes through untouched (VPS editor path / transparently-decoded legacy object)', async () => {
    const db = fake_sqlite_db()
    const decoded = await decode_snapshot_bytes(db)
    expect(decoded).toBe(db)
  })
})
