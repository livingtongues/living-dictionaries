import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { open_test_shared_db } from './shared-db'

/** 100MB — a legitimately-scanned dictionary fits; anything larger suggests a mistake. */
export const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024

export interface SourceFileRow {
  id: string
  dictionary_id: string
  source_id: string | null
  filename: string
  mimetype: string
  size_bytes: number
  storage_key: string
  import_instructions: string | null
  source_note: string | null
  upload_confirmed_at: string | null
  import_requested_at: string | null
  import_thread_id: string | null
  uploaded_by_user_id: string
  created_at: string
  updated_at: string
}

export function source_file_storage_key({ dictionary_id, file_id }: { dictionary_id: string, file_id: string }): string {
  return `import/${dictionary_id}/${file_id}`
}

export function create_pending_source_file({ db, dictionary_id, filename, mimetype, size_bytes, uploaded_by_user_id, now = new Date().toISOString() }: {
  db: Database
  dictionary_id: string
  filename: string
  mimetype: string
  size_bytes: number
  uploaded_by_user_id: string
  now?: string
}): SourceFileRow {
  const id = randomUUID()
  const storage_key = source_file_storage_key({ dictionary_id, file_id: id })
  db.prepare(`
    INSERT INTO source_files (
      id, dictionary_id, filename, mimetype, size_bytes, storage_key,
      uploaded_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dictionary_id, filename, mimetype, size_bytes, storage_key, uploaded_by_user_id, now, now)
  return get_source_file({ db, dictionary_id, file_id: id }) as SourceFileRow
}

export function confirm_source_file({ db, dictionary_id, file_id, size_bytes, now = new Date().toISOString() }: {
  db: Database
  dictionary_id: string
  file_id: string
  /** Actual byte count observed on the stored object, when known. */
  size_bytes?: number
  now?: string
}): SourceFileRow | null {
  db.prepare(`
    UPDATE source_files SET
      upload_confirmed_at = COALESCE(upload_confirmed_at, ?),
      size_bytes = COALESCE(?, size_bytes),
      updated_at = ?
    WHERE id = ? AND dictionary_id = ?
  `).run(now, size_bytes ?? null, now, file_id, dictionary_id)
  return get_source_file({ db, dictionary_id, file_id })
}

export function list_source_files({ db, dictionary_id }: { db: Database, dictionary_id: string }): SourceFileRow[] {
  return db.prepare('SELECT * FROM source_files WHERE dictionary_id = ? ORDER BY created_at')
    .all(dictionary_id) as SourceFileRow[]
}

export function get_source_file({ db, dictionary_id, file_id }: { db: Database, dictionary_id: string, file_id: string }): SourceFileRow | null {
  const row = db.prepare('SELECT * FROM source_files WHERE id = ? AND dictionary_id = ?')
    .get(file_id, dictionary_id) as SourceFileRow | undefined
  return row ?? null
}

const UPDATABLE_FIELDS = ['filename', 'import_instructions', 'source_note', 'source_id'] as const
export type SourceFileUpdatableField = typeof UPDATABLE_FIELDS[number]

export function update_source_file({ db, dictionary_id, file_id, fields, now = new Date().toISOString() }: {
  db: Database
  dictionary_id: string
  file_id: string
  fields: Partial<Record<SourceFileUpdatableField, string | null>>
  now?: string
}): SourceFileRow | null {
  const provided = UPDATABLE_FIELDS.filter(field => field in fields)
  if (provided.length) {
    const assignments = provided.map(field => `${field} = ?`).join(', ')
    db.prepare(`UPDATE source_files SET ${assignments}, updated_at = ? WHERE id = ? AND dictionary_id = ?`)
      .run(...provided.map(field => fields[field] ?? null), now, file_id, dictionary_id)
  }
  return get_source_file({ db, dictionary_id, file_id })
}

/** Removes the row; the caller deletes the R2 object with the returned storage_key. */
export function delete_source_file({ db, dictionary_id, file_id }: { db: Database, dictionary_id: string, file_id: string }): { storage_key: string } | null {
  const row = get_source_file({ db, dictionary_id, file_id })
  if (!row)
    return null
  db.prepare('DELETE FROM source_files WHERE id = ? AND dictionary_id = ?').run(file_id, dictionary_id)
  return { storage_key: row.storage_key }
}

/** Stamps a batch of files as covered by one import-request thread. */
export function mark_files_requested({ db, dictionary_id, file_ids, thread_id, now = new Date().toISOString() }: {
  db: Database
  dictionary_id: string
  file_ids: string[]
  thread_id: string
  now?: string
}): void {
  const stamp = db.prepare(`
    UPDATE source_files SET import_requested_at = ?, import_thread_id = ?, updated_at = ?
    WHERE id = ? AND dictionary_id = ? AND import_requested_at IS NULL
  `)
  const txn = db.transaction(() => {
    for (const file_id of file_ids)
      stamp.run(now, thread_id, now, file_id, dictionary_id)
  })
  txn()
}

if (import.meta.vitest) {
  function seed() {
    const db = open_test_shared_db()
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('u1', 'manager@example.com')
    return db
  }

  describe(create_pending_source_file, () => {
    test('creates an unconfirmed row keyed under import/{dict}/{id}', () => {
      const db = seed()
      const row = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'scan.pdf', mimetype: 'application/pdf', size_bytes: 123, uploaded_by_user_id: 'u1' })
      expect(row.storage_key).toBe(`import/d1/${row.id}`)
      expect(row.upload_confirmed_at).toBe(null)
      expect(row.import_requested_at).toBe(null)
    })
  })

  describe(confirm_source_file, () => {
    test('stamps confirmation once and can correct size', () => {
      const db = seed()
      const row = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'a.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      const confirmed = confirm_source_file({ db, dictionary_id: 'd1', file_id: row.id, size_bytes: 42, now: '2026-07-17T01:00:00Z' })
      expect(confirmed?.upload_confirmed_at).toBe('2026-07-17T01:00:00Z')
      expect(confirmed?.size_bytes).toBe(42)
      const again = confirm_source_file({ db, dictionary_id: 'd1', file_id: row.id, now: '2026-07-17T02:00:00Z' })
      expect(again?.upload_confirmed_at).toBe('2026-07-17T01:00:00Z')
    })

    test('scoped to the dictionary', () => {
      const db = seed()
      const row = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'a.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      expect(confirm_source_file({ db, dictionary_id: 'OTHER', file_id: row.id })?.upload_confirmed_at ?? null).toBe(null)
    })
  })

  describe(update_source_file, () => {
    test('updates only provided fields', () => {
      const db = seed()
      const row = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'a.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      const updated = update_source_file({ db, dictionary_id: 'd1', file_id: row.id, fields: { import_instructions: 'Skip page 1', source_id: 'src-9' } })
      expect(updated?.import_instructions).toBe('Skip page 1')
      expect(updated?.source_id).toBe('src-9')
      expect(updated?.filename).toBe('a.csv')
      const cleared = update_source_file({ db, dictionary_id: 'd1', file_id: row.id, fields: { source_id: null } })
      expect(cleared?.source_id).toBe(null)
    })
  })

  describe(delete_source_file, () => {
    test('removes the row and hands back the storage key', () => {
      const db = seed()
      const row = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'a.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      expect(delete_source_file({ db, dictionary_id: 'd1', file_id: row.id })).toEqual({ storage_key: row.storage_key })
      expect(get_source_file({ db, dictionary_id: 'd1', file_id: row.id })).toBe(null)
      expect(delete_source_file({ db, dictionary_id: 'd1', file_id: row.id })).toBe(null)
    })
  })

  describe(mark_files_requested, () => {
    test('stamps unrequested files only', () => {
      const db = seed()
      const first = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'a.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      const second = create_pending_source_file({ db, dictionary_id: 'd1', filename: 'b.csv', mimetype: 'text/csv', size_bytes: 10, uploaded_by_user_id: 'u1' })
      mark_files_requested({ db, dictionary_id: 'd1', file_ids: [first.id], thread_id: 't1', now: '2026-07-17T01:00:00Z' })
      mark_files_requested({ db, dictionary_id: 'd1', file_ids: [first.id, second.id], thread_id: 't2', now: '2026-07-17T02:00:00Z' })
      const rows = list_source_files({ db, dictionary_id: 'd1' })
      expect(rows.find(row => row.id === first.id)?.import_thread_id).toBe('t1')
      expect(rows.find(row => row.id === second.id)?.import_thread_id).toBe('t2')
    })
  })
}
