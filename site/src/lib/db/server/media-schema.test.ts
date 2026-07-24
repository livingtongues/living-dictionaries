import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_test_shared_db } from './shared-db'

function columns(db: ReturnType<typeof open_dictionary_db_in_memory> | ReturnType<typeof open_test_shared_db>, table: string): string[] {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(row => row.name)
}

describe('R2-only media schema', () => {
  test('fresh dictionary databases store photos by storage path only', () => {
    const db = open_dictionary_db_in_memory('media-schema')
    expect(columns(db, 'photos')).not.toContain('serving_url')
    expect(columns(db, 'photos')).toContain('storage_path')
    db.close()
  })

  test('fresh shared databases store partner and featured photos by storage path only', () => {
    const db = open_test_shared_db()
    expect(columns(db, 'dictionary_partners')).not.toContain('photo_serving_url')
    expect(columns(db, 'dictionary_partners')).toContain('photo_storage_path')
    expect(columns(db, 'featured_entries')).not.toContain('photo_serving_url')
    expect(columns(db, 'featured_entries')).toContain('photo_storage_path')
    db.close()
  })
})
