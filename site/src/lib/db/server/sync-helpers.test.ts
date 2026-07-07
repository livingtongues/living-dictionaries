import type Database from 'better-sqlite3'
import type { SyncRequest } from '$lib/db/sync/types'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_logs_db } from './logs-db'
import { latest_shared_migration_name, open_shared_db } from './shared-db'
import { process_sync } from './sync-helpers'

let db: Database.Database

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

function empty_request(): SyncRequest {
  return {
    synced_up_to: null,
    dirty_rows: {},
    deletes: [],
    latest_migration: latest_shared_migration_name,
  }
}

describe(process_sync, () => {
  test('completes a round trip on a healthy DB', () => {
    const response = process_sync({ db, request: empty_request() })
    expect(response.deletes).toEqual([])
    expect(response.changes.dictionary_partners).toBeUndefined()
  })

  // Regression: a syncable table absent on a DB provisioned before the migration
  // that added it (the `dictionary_partners` consolidation-drift incident) must
  // NOT 500 the whole admin sync — it should skip + log the missing table.
  test('skips and logs a missing syncable table instead of throwing', () => {
    db.exec('DROP TABLE dictionary_partners')
    // `client_logs` lives in logs.db (split out of shared.db 2026-07-05), so the
    // drift warn must land there — logging to the shared `db` would silently drop
    // on a post-split server where that table is gone.
    const logs_db = open_logs_db(':memory:')

    const response = process_sync({ db, request: empty_request(), user_id: 'admin-1', logs_db })
    expect(response.changes.dictionary_partners).toBeUndefined()

    const log = logs_db.prepare(
      `SELECT level, message, context FROM client_logs WHERE message = 'sync_missing_syncable_table'`,
    ).get() as { level: string, message: string, context: string } | undefined
    expect(log).toBeDefined()
    expect(log?.level).toBe('warn')
    expect(JSON.parse(log?.context ?? '{}').missing_tables).toEqual(['dictionary_partners'])
    logs_db.close()
  })

  test('still pushes a dirty row for a present table when another table is missing', () => {
    db.exec('DROP TABLE dictionary_partners')
    db.prepare(`INSERT INTO dictionaries (id, name, updated_at) VALUES ('d1', 'Demo', '2026-06-29T00:00:00.000Z')`).run()

    const request = empty_request()
    request.synced_up_to = '2026-06-28T00:00:00.000Z'
    const response = process_sync({ db, request, user_id: 'admin-1' })
    expect(response.changes.dictionaries?.find(row => row.id === 'd1')).toBeDefined()
  })
})
