import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { POST } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let api_token: string
let imported_ids: string[]
let keeper_id: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'D', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'u1' }).token

  const imported = apply_entry_writes({ db: dict_db, user_id: 'u1', import_id: 'smith-2026-07', entries: [
    { lexeme: 'uno', senses: [{ glosses: { en: 'one' }, example_sentences: [{ text: 'uno dos tres', translation: 'one two three' }] }] },
    { lexeme: 'dos', senses: [{ glosses: { en: 'two' } }] },
    { lexeme: 'tres', senses: [{ glosses: { en: 'three' } }] },
  ] })
  imported_ids = imported.results.map(result => result.entry_id as string)
  const keeper = apply_entry_writes({ db: dict_db, user_id: 'u1', entries: [{ lexeme: 'perro', senses: [{ glosses: { en: 'dog' } }] }] })
  keeper_id = keeper.results[0].entry_id as string
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function call({ api_key, body }: { api_key?: string, body: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request(`http://localhost/api/v1/dictionaries/dict-1/entries/batch-delete`, { method: 'POST', headers, body: JSON.stringify(body) })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}

function count(sql: string): number {
  return (dict_db.prepare(sql).get() as { c: number }).c
}

describe(POST, () => {
  test('401 without a credential', async () => {
    await expect(call({ body: { import_id: 'smith-2026-07', dry_run: true } })).rejects.toMatchObject({ status: 401 })
  })

  test('400 without an import_id', async () => {
    await expect(call({ api_key: api_token, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('404 for an unknown import_id', async () => {
    await expect(call({ api_key: api_token, body: { import_id: 'ghost-import', dry_run: true } })).rejects.toMatchObject({ status: 404 })
  })

  test('dry_run reports count + samples and writes NOTHING', async () => {
    const res = await call({ api_key: api_token, body: { import_id: 'smith-2026-07', dry_run: true } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ import_id: 'smith-2026-07', count: 3, sample_entry_ids: imported_ids, deleted: false })
    expect(count(`SELECT COUNT(*) c FROM entries`)).toBe(4)
    expect(count(`SELECT COUNT(*) c FROM deletes`)).toBe(0)
  })

  test('import_id match is case-insensitive (mirrors tag find-or-create)', async () => {
    const res = await call({ api_key: api_token, body: { import_id: 'SMITH-2026-07', dry_run: true } })
    expect((await res.json()).count).toBe(3)
  })

  test('400 when a real run omits confirm_count', async () => {
    await expect(call({ api_key: api_token, body: { import_id: 'smith-2026-07' } })).rejects.toMatchObject({ status: 400 })
    expect(count(`SELECT COUNT(*) c FROM entries`)).toBe(4)
  })

  test('409 when confirm_count does not match the live count', async () => {
    await expect(call({ api_key: api_token, body: { import_id: 'smith-2026-07', confirm_count: 2 } })).rejects.toMatchObject({ status: 409 })
    expect(count(`SELECT COUNT(*) c FROM entries`)).toBe(4)
  })

  test('real run tombstones the batch + tag, cascades senses, keeps other entries and orphaned sentences', async () => {
    const sentence_count = count(`SELECT COUNT(*) c FROM sentences`)
    expect(sentence_count).toBe(1)

    const res = await call({ api_key: api_token, body: { import_id: 'smith-2026-07', confirm_count: 3 } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ import_id: 'smith-2026-07', count: 3, sample_entry_ids: imported_ids, deleted: true, tag_deleted: true })

    // Batch gone; unrelated entry survives.
    expect(count(`SELECT COUNT(*) c FROM entries`)).toBe(1)
    expect(dict_db.prepare(`SELECT id FROM entries`).get()).toEqual({ id: keeper_id })
    // Cascade removed the batch's senses + junctions; the import tag is gone too.
    expect(count(`SELECT COUNT(*) c FROM senses WHERE entry_id != '${keeper_id}'`)).toBe(0)
    expect(count(`SELECT COUNT(*) c FROM entry_tags`)).toBe(0)
    expect(count(`SELECT COUNT(*) c FROM tags`)).toBe(0)
    // Documented v1 behavior: the orphaned standalone example sentence is LEFT.
    expect(count(`SELECT COUNT(*) c FROM sentences`)).toBe(1)
    expect(count(`SELECT COUNT(*) c FROM senses_in_sentences`)).toBe(0)
    // Tombstones exist for peers/snapshot (3 entries + 1 tag).
    expect(count(`SELECT COUNT(*) c FROM deletes WHERE table_name = 'entries'`)).toBe(3)
    expect(count(`SELECT COUNT(*) c FROM deletes WHERE table_name = 'tags'`)).toBe(1)
    // History captured delete events with before-images.
    expect((history_db.prepare(`SELECT COUNT(*) c FROM changes WHERE op = 'delete' AND table_name = 'entries'`).get() as { c: number }).c).toBe(3)
  })

  test('a repeat run 404s (tag already deleted) — retries cannot re-fire', async () => {
    await call({ api_key: api_token, body: { import_id: 'smith-2026-07', confirm_count: 3 } })
    await expect(call({ api_key: api_token, body: { import_id: 'smith-2026-07', dry_run: true } })).rejects.toMatchObject({ status: 404 })
  })
})
