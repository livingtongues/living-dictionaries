import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET as SECTIONS_GET, POST as SECTIONS_POST } from './+server'
import { DELETE as SECTION_DELETE, GET as SECTION_GET, PATCH as SECTION_PATCH } from './[sectionId]/+server'
import { POST as LINK_POST } from './[sectionId]/sentences/+server'
import { DELETE as LINK_DELETE } from './[sectionId]/sentences/[sentenceId]/+server'
import { GET as SLOTS_GET, POST as SLOTS_POST } from '../clause-slots/+server'
import { GET as GLOSS_GET, POST as GLOSS_POST } from '../glossing-abbreviations/+server'
import { GET as ENTRY_GRAMMAR_GET } from '../../entries/[entryId]/grammar/+server'
import { GET as TEXT_TAGS_GET, POST as TEXT_TAGS_POST } from '../../texts/[textId]/tags/+server'
import { DELETE as TEXT_TAG_DELETE } from '../../texts/[textId]/tags/[tagId]/+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let write_key: string
let read_key: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

const NOW = '2026-01-01T00:00:00Z'
function seed(table: string, row: Record<string, unknown>) {
  const full = { created_by_user_id: 'edt-1', created_at: NOW, updated_by_user_id: 'edt-1', updated_at: NOW, ...row }
  const cols = Object.keys(full)
  dict_db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})`).run(full)
}

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([{ provider: 'email', provider_id: 'edt@x.com' }]), NOW, NOW)
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('dict-1', 'dict-1', NOW, NOW)
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function req(method: string, path: string, key: string, body?: unknown) {
  const url = `http://localhost/api/v1/dictionaries/dict-1${path}`
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  if (body !== undefined) headers['content-type'] = 'application/json'
  return new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}
function ev(request: Request, params: Record<string, string>) {
  return { request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params }, url: new URL(request.url) } as never
}

describe('grammar section routes', () => {
  test('full CRUD + example link/unlink + reverse lookup', async () => {
    seed('entries', { id: 'e1', lexeme: JSON.stringify({ en: 'le' }) })
    seed('sentences', { id: 's1', text: JSON.stringify({ default: 'lorem' }) })

    const created = await (await SECTIONS_POST(ev(req('POST', '/grammar/sections', write_key, { title: 'Aspect', entry_id: 'e1' }), {}))).json()
    expect(created.created).toBeTruthy()
    const section_id = created.section.id

    const list = await (await SECTIONS_GET(ev(req('GET', '/grammar/sections', read_key), {}))).json()
    expect(list.sections).toHaveLength(1)

    // link + unlink an example sentence by reference
    const linked = await (await LINK_POST(ev(req('POST', `/grammar/sections/${section_id}/sentences`, write_key, { sentence_id: 's1' }), { sectionId: section_id }))).json()
    expect(linked.link.sentence_id).toBe('s1')
    const one = await (await SECTION_GET(ev(req('GET', `/grammar/sections/${section_id}`, read_key), { sectionId: section_id }))).json()
    expect(one.section.example_sentences).toHaveLength(1)
    await LINK_DELETE(ev(req('DELETE', `/grammar/sections/${section_id}/sentences/s1`, write_key), { sectionId: section_id, sentenceId: 's1' }))

    // reverse lookup from the entry
    const reverse = await (await ENTRY_GRAMMAR_GET(ev(req('GET', '/entries/e1/grammar', read_key), { entryId: 'e1' }))).json()
    expect(reverse.sections.map((s: { id: string }) => s.id)).toContain(section_id)

    // patch + delete
    const patched = await (await SECTION_PATCH(ev(req('PATCH', `/grammar/sections/${section_id}`, write_key, { number_label: '1.1' }), { sectionId: section_id }))).json()
    expect(patched.section.number_label).toBe('1.1')
    const del = await (await SECTION_DELETE(ev(req('DELETE', `/grammar/sections/${section_id}`, write_key), { sectionId: section_id }))).json()
    expect(del.result).toBe('deleted')
    await expect(SECTION_GET(ev(req('GET', `/grammar/sections/${section_id}`, read_key), { sectionId: section_id }))).rejects.toMatchObject({ status: 404 })
  })

  test('403 when a read key writes; 400 without a title', async () => {
    await expect(SECTIONS_POST(ev(req('POST', '/grammar/sections', read_key, { title: 'x' }), {}))).rejects.toMatchObject({ status: 403 })
    await expect(SECTIONS_POST(ev(req('POST', '/grammar/sections', write_key, {}), {}))).rejects.toMatchObject({ status: 400 })
  })

  test('clause slots, glossing legend, and text tags round-trip', async () => {
    seed('texts', { id: 't1', title: JSON.stringify({ en: 'Story' }) })

    const slot = await (await SLOTS_POST(ev(req('POST', '/grammar/clause-slots', write_key, { name: 'pre-verb', code: 'pre_verb' }), {}))).json()
    expect(slot.created).toBeTruthy()
    expect((await (await SLOTS_GET(ev(req('GET', '/grammar/clause-slots', read_key), {}))).json()).clause_slots).toHaveLength(1)

    const gloss = await (await GLOSS_POST(ev(req('POST', '/grammar/glossing-abbreviations', write_key, { code: '3PL', name: 'third person plural' }), {}))).json()
    expect(gloss.glossing_abbreviation.code).toBe('3PL')
    expect((await (await GLOSS_GET(ev(req('GET', '/grammar/glossing-abbreviations', read_key), {}))).json()).glossing_abbreviations).toHaveLength(1)

    const tag = await (await TEXT_TAGS_POST(ev(req('POST', '/texts/t1/tags', write_key, { name: 'Trickster', kind: 'motif', code: 'K1' }), { textId: 't1' }))).json()
    expect(tag.tag).toMatchObject({ name: 'Trickster', kind: 'motif', code: 'K1' })
    expect((await (await TEXT_TAGS_GET(ev(req('GET', '/texts/t1/tags', read_key), { textId: 't1' }))).json()).tags).toHaveLength(1)
    const untag = await (await TEXT_TAG_DELETE(ev(req('DELETE', `/texts/t1/tags/${tag.tag.id}`, write_key), { textId: 't1', tagId: tag.tag.id }))).json()
    expect(untag.result).toBe('unlinked')
  })
})
