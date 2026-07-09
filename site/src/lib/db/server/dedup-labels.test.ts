import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { dedup_dict_labels } from './dedup-labels'

let db: Database.Database
const USER = 'user-1'

beforeEach(() => {
  db = open_dictionary_db_in_memory('test-dict')
})

afterEach(() => {
  db.close()
})

function insert_entry(id: string) {
  db.prepare(
    `INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?)`,
  ).run(id, JSON.stringify({ default: id }), USER, USER)
}

function insert_tag({ id, name, created_at, is_private }: { id: string, name: string, created_at: string, is_private?: number | null }) {
  db.prepare(
    `INSERT INTO tags (id, name, "private", created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, is_private ?? null, USER, created_at, USER, created_at)
}

function link_tag({ entry_id, tag_id }: { entry_id: string, tag_id: string }) {
  db.prepare(
    `INSERT INTO entry_tags (id, entry_id, tag_id, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?)`,
  ).run(`${entry_id}-${tag_id}`, entry_id, tag_id, USER, USER)
}

function insert_dialect({ id, name, created_at }: { id: string, name: object, created_at: string }) {
  db.prepare(
    `INSERT INTO dialects (id, name, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, JSON.stringify(name), USER, created_at, USER, created_at)
}

function link_dialect({ entry_id, dialect_id }: { entry_id: string, dialect_id: string }) {
  db.prepare(
    `INSERT INTO entry_dialects (id, entry_id, dialect_id, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?)`,
  ).run(`${entry_id}-${dialect_id}`, entry_id, dialect_id, USER, USER)
}

const tag_ids = () => (db.prepare(`SELECT id FROM tags ORDER BY id`).all() as { id: string }[]).map(r => r.id)
const tags_for_entry = (entry_id: string) => (db.prepare(`SELECT tag_id FROM entry_tags WHERE entry_id = ? ORDER BY tag_id`).all(entry_id) as { tag_id: string }[]).map(r => r.tag_id)
const tombstones = () => (db.prepare(`SELECT table_name, id FROM deletes ORDER BY id`).all() as { table_name: string, id: string }[])

describe(dedup_dict_labels, () => {
  test('collapses three same-name tags on one entry (the sugtstun case)', () => {
    insert_entry('e1')
    insert_tag({ id: 't-above-1', name: 'above', created_at: '2025-01-01T00:00:00Z' })
    insert_tag({ id: 't-above-2', name: 'above', created_at: '2025-02-01T00:00:00Z' })
    insert_tag({ id: 't-above-3', name: 'above', created_at: '2025-03-01T00:00:00Z' })
    insert_tag({ id: 't-millie', name: 'Millie', created_at: '2025-01-01T00:00:00Z' })
    link_tag({ entry_id: 'e1', tag_id: 't-above-1' })
    link_tag({ entry_id: 'e1', tag_id: 't-above-2' })
    link_tag({ entry_id: 'e1', tag_id: 't-above-3' })
    link_tag({ entry_id: 'e1', tag_id: 't-millie' })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.tag_groups_merged).toBe(1)
    expect(report.tags_removed).toBe(2)
    expect(report.tag_junctions_created).toBe(0) // canonical junction already existed
    expect(tag_ids()).toEqual(['t-above-1', 't-millie'])
    expect(tags_for_entry('e1')).toEqual(['t-above-1', 't-millie'])
    expect(tombstones()).toEqual([
      { table_name: 'tags', id: 't-above-2' },
      { table_name: 'tags', id: 't-above-3' },
    ])
  })

  test('repoints an entry linked only to a duplicate onto the canonical', () => {
    insert_entry('e1')
    insert_entry('e2')
    insert_tag({ id: 't-canon', name: 'boat', created_at: '2025-01-01T00:00:00Z' })
    insert_tag({ id: 't-dup', name: 'Boat', created_at: '2025-02-01T00:00:00Z' }) // case-insensitive match
    link_tag({ entry_id: 'e1', tag_id: 't-canon' })
    link_tag({ entry_id: 'e2', tag_id: 't-dup' }) // e2 only has the dup

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.tags_removed).toBe(1)
    expect(report.tag_junctions_created).toBe(1)
    expect(tag_ids()).toEqual(['t-canon'])
    expect(tags_for_entry('e1')).toEqual(['t-canon'])
    expect(tags_for_entry('e2')).toEqual(['t-canon'])
  })

  test('public-wins on the private flag', () => {
    insert_entry('e1')
    insert_tag({ id: 't-canon', name: 'secret', created_at: '2025-01-01T00:00:00Z', is_private: 1 })
    insert_tag({ id: 't-dup', name: 'secret', created_at: '2025-02-01T00:00:00Z', is_private: null })
    link_tag({ entry_id: 'e1', tag_id: 't-canon' })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.tag_privacy_widened).toBe(1)
    const canon = db.prepare(`SELECT "private" FROM tags WHERE id = 't-canon'`).get() as { private: number | null }
    expect(canon.private).toBeNull()
  })

  test('keeps private when every member is private', () => {
    insert_entry('e1')
    insert_tag({ id: 't-canon', name: 'hidden', created_at: '2025-01-01T00:00:00Z', is_private: 1 })
    insert_tag({ id: 't-dup', name: 'hidden', created_at: '2025-02-01T00:00:00Z', is_private: 1 })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.tag_privacy_widened).toBe(0)
    const canon = db.prepare(`SELECT "private" FROM tags WHERE id = 't-canon'`).get() as { private: number | null }
    expect(canon.private).toBe(1)
  })

  test('unions dialect locale keys into the canonical', () => {
    insert_entry('e1')
    insert_dialect({ id: 'd-canon', name: { default: 'Coast' }, created_at: '2025-01-01T00:00:00Z' })
    insert_dialect({ id: 'd-dup', name: { default: 'coast', es: 'Costa' }, created_at: '2025-02-01T00:00:00Z' })
    link_dialect({ entry_id: 'e1', dialect_id: 'd-dup' })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.dialect_groups_merged).toBe(1)
    expect(report.dialects_removed).toBe(1)
    expect(report.dialect_locales_filled).toBe(1)
    expect(report.dialect_junctions_created).toBe(1)
    const canon = db.prepare(`SELECT name FROM dialects WHERE id = 'd-canon'`).get() as { name: string }
    expect(JSON.parse(canon.name)).toEqual({ default: 'Coast', es: 'Costa' })
    const linked = (db.prepare(`SELECT dialect_id FROM entry_dialects WHERE entry_id = 'e1'`).all() as { dialect_id: string }[]).map(r => r.dialect_id)
    expect(linked).toEqual(['d-canon'])
  })

  test('dry_run computes counts without writing', () => {
    insert_entry('e1')
    insert_tag({ id: 't-1', name: 'dup', created_at: '2025-01-01T00:00:00Z' })
    insert_tag({ id: 't-2', name: 'dup', created_at: '2025-02-01T00:00:00Z' })
    link_tag({ entry_id: 'e1', tag_id: 't-2' })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: true })

    expect(report.tags_removed).toBe(1)
    expect(report.tag_junctions_created).toBe(1)
    // nothing actually changed:
    expect(tag_ids()).toEqual(['t-1', 't-2'])
    expect(tombstones()).toEqual([])
  })

  test('no duplicates → empty report', () => {
    insert_entry('e1')
    insert_tag({ id: 't-1', name: 'unique-a', created_at: '2025-01-01T00:00:00Z' })
    insert_tag({ id: 't-2', name: 'unique-b', created_at: '2025-01-01T00:00:00Z' })

    const report = dedup_dict_labels({ db, user_id: USER, dry_run: false })

    expect(report.tag_groups_merged).toBe(0)
    expect(report.tags_removed).toBe(0)
  })
})
