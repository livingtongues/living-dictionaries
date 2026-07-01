import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { merge_dict_row } from '$lib/db/server/dictionary-sync-helpers'
import { open_shared_db } from '$lib/db/server/shared-db'
import { store_media_bytes } from '$lib/server/media-storage'
import { make_media_attach_handler, make_media_delete_handler } from './media-route-handlers'

let shared_db: ReturnType<typeof open_shared_db>
let dict_db: Database.Database
let history_db: Database.Database
let write_key: string
let read_key: string
const NOW = '2026-01-01T00:00:00.000Z'

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/db/server/dictionary-history-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-history-db')>()), get_dictionary_history_db: () => history_db }))
vi.mock('$lib/server/media-storage', async (orig) => {
  const actual = await orig<typeof import('$lib/server/media-storage')>()
  return {
    ...actual,
    store_media_bytes: vi.fn(({ folder, file_name }: { folder: string, file_name: string }) => Promise.resolve({ storage_path: `${folder}/mock.${file_name.split('.').pop()}`, bucket: 'bucket', dev_mock: false })),
    resolve_photo_serving_url: vi.fn(() => Promise.resolve('mockservinghash')),
  }
})

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  vi.clearAllMocks()
  shared_db = open_shared_db(':memory:')
  dict_db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([]), NOW, NOW)
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'dict-1', NOW, NOW)
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
  merge_dict_row({ db: dict_db, table_name: 'entries', row: { id: 'e1', lexeme: { default: 'mbwa' }, created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
  merge_dict_row({ db: dict_db, table_name: 'senses', row: { id: 's1', entry_id: 'e1', created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
  merge_dict_row({ db: dict_db, table_name: 'speakers', row: { id: 'sp1', name: 'Ana', created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  shared_db.close()
  dict_db.close()
  history_db.close()
})

function audio_file() {
  return new File([new Uint8Array([1, 2, 3])], 'rec.mp3', { type: 'audio/mpeg' })
}

function attach({ cell, params, fields, file, key = write_key }: { cell: Parameters<typeof make_media_attach_handler>[0], params: Record<string, string>, fields?: Record<string, string>, file?: File | null, key?: string }) {
  const handler = make_media_attach_handler(cell)
  const form = new FormData()
  if (file !== null)
    form.set('file', file ?? audio_file())
  for (const [k, v] of Object.entries(fields ?? {}))
    form.set(k, v)
  const request = new Request('http://localhost/api/v1/media', { method: 'POST', body: form, headers: { Authorization: `Bearer ${key}` } })
  return handler({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params } } as never)
}

function attach_json({ cell, params, body, key = write_key }: { cell: Parameters<typeof make_media_attach_handler>[0], params: Record<string, string>, body: unknown, key?: string }) {
  const handler = make_media_attach_handler(cell)
  const request = new Request('http://localhost/api/v1/media', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return handler({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params } } as never)
}

describe(make_media_attach_handler, () => {
  test('audio→entry: multipart upload + speaker', async () => {
    const res = await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1', source: 'field-2026' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBeTruthy()
    expect(body.audio.storage_path).toBe('dict-1/audio/e1/mock.mp3')
    expect(body.audio.speakers).toEqual([{ id: 'sp1', name: 'Ana' }])
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
    expect(dict_db.prepare(`SELECT source FROM audio WHERE entry_id = ?`).get('e1')).toEqual({ source: 'field-2026' })
  })

  test('audio→entry: JSON url fetches bytes server-side', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg', 'content-length': '3' } }))))
    const res = await attach_json({ cell: 'audio:entry', params: { entryId: 'e1' }, body: { url: 'https://example.com/sound.mp3' } })
    expect(res.status).toBe(200)
    expect((await res.json()).audio.storage_path).toBeTruthy()
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
  })

  test('replace:true removes prior audio on the entry', async () => {
    await attach({ cell: 'audio:entry', params: { entryId: 'e1' } })
    await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { replace: 'true' } })
    expect(dict_db.prepare(`SELECT COUNT(*) AS c FROM audio WHERE entry_id = ?`).get('e1')).toEqual({ c: 1 })
  })

  test('idempotent id: re-POST is a no-op and does NOT re-upload', async () => {
    const first = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { id: 'aud-1' } })).json()
    expect(first.created).toBeTruthy()
    const second = await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { id: 'aud-1' } })
    expect((await second.json()).created).toBeFalsy()
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
    expect(dict_db.prepare(`SELECT COUNT(*) AS c FROM audio`).get()).toEqual({ c: 1 })
  })

  test('404 for an unknown owner (no upload attempted)', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'ghost' } })).rejects.toMatchObject({ status: 404 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('400 for an unknown speaker', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'ghost' } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 when neither file nor url is provided', async () => {
    await expect(attach_json({ cell: 'audio:entry', params: { entryId: 'e1' }, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('403 for a read-only key', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, key: read_key })).rejects.toMatchObject({ status: 403 })
  })

  test('photo→sense: multipart upload generates a serving_url + links the junction', async () => {
    const res = await attach({ cell: 'photo:sense', params: { senseId: 's1' }, fields: { photographer: 'Sam' }, file: new File([new Uint8Array([9])], 'pic.jpg', { type: 'image/jpeg' }) })
    const body = await res.json()
    expect(body.photo.serving_url).toBe('mockservinghash')
    expect(body.photo.photographer).toBe('Sam')
    const junction = dict_db.prepare(`SELECT 1 FROM sense_photos WHERE sense_id = ? AND photo_id = ?`).get('s1', body.photo.id)
    expect(junction).toBeTruthy()
  })

  test('video→sense: hosted_url (multipart, no file) is parsed to hosted_elsewhere', async () => {
    const res = await attach({ cell: 'video:sense', params: { senseId: 's1' }, fields: { hosted_url: 'https://www.youtube.com/watch?v=GrsknWZpr-k' }, file: null })
    const body = await res.json()
    expect(body.video.hosted_elsewhere).toEqual({ type: 'youtube', video_id: 'GrsknWZpr-k' })
    expect(store_media_bytes).not.toHaveBeenCalled()
    expect(dict_db.prepare(`SELECT 1 FROM sense_videos WHERE sense_id = ? AND video_id = ?`).get('s1', body.video.id)).toBeTruthy()
  })

  test('video→sense: structured hosted_elsewhere via JSON', async () => {
    const res = await attach_json({ cell: 'video:sense', params: { senseId: 's1' }, body: { hosted_elsewhere: { type: 'vimeo', video_id: '239862299' } } })
    expect((await res.json()).video.hosted_elsewhere).toEqual({ type: 'vimeo', video_id: '239862299' })
  })
})

describe(make_media_delete_handler, () => {
  function del({ cell, params, key = write_key }: { cell: Parameters<typeof make_media_delete_handler>[0], params: Record<string, string>, key?: string }) {
    const handler = make_media_delete_handler(cell)
    const request = new Request('http://localhost/api/v1/media', { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } })
    return handler({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params } } as never)
  }

  test('deletes an attached audio', async () => {
    const created = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' } })).json()
    const res = await del({ cell: 'audio:entry', params: { entryId: 'e1', audioId: created.audio.id } })
    expect((await res.json()).result).toBe('deleted')
    expect(dict_db.prepare(`SELECT 1 FROM audio WHERE id = ?`).get(created.audio.id)).toBeUndefined()
  })

  test('404 when the media is not linked to the owner', async () => {
    const created = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' } })).json()
    await expect(del({ cell: 'audio:entry', params: { entryId: 'ghost', audioId: created.audio.id } })).rejects.toMatchObject({ status: 404 })
  })
})
