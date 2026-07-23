import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_dictionary_history_db_in_memory } from '$lib/db/server/dictionary-history-db'
import { merge_dict_row } from '$lib/db/server/dictionary-sync-helpers'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { store_media_bytes } from '$lib/server/media-storage'
import { fetch_hosted_video_metadata } from '$lib/video/hosted-video-metadata'
import { make_media_attach_handler, make_media_delete_handler, make_media_timings_patch_handler } from './media-route-handlers'

let shared_db: ReturnType<typeof open_test_shared_db>
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
    store_media_bytes: vi.fn(({ folder, file_name, r2_key }: { folder?: string, file_name: string, r2_key?: string }) => Promise.resolve({ storage_path: r2_key ?? `${folder}/mock.${file_name.split('.').pop()}`, bucket: 'bucket', dev_mock: false })),
  }
})
vi.mock('$lib/video/hosted-video-metadata', () => ({
  fetch_hosted_video_metadata: vi.fn(({ hosted_video }) => Promise.resolve(hosted_video.type === 'vimeo'
    ? { title: 'Vimeo film', thumbnail_url: 'https://example.com/vimeo.jpg', duration_seconds: 64 }
    : { title: 'YouTube clip', thumbnail_url: 'https://example.com/youtube.jpg' })),
}))

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  vi.clearAllMocks()
  shared_db = open_test_shared_db()
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
  merge_dict_row({ db: dict_db, table_name: 'sentences', row: { id: 'sent1', text: { default: 'Mbwa wangu' }, created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
  merge_dict_row({ db: dict_db, table_name: 'speakers', row: { id: 'sp1', name: 'Ana', created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
  merge_dict_row({ db: dict_db, table_name: 'sources', row: { id: 'src1', slug: 'field-2026', citation: 'Fieldwork 2026', created_at: NOW, updated_at: NOW }, user_id: 'edt-1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  shared_db.close()
  dict_db.close()
  history_db.close()
})

// Real MP3 (frame-sync) / JPEG magic bytes so the server-side media validation
// (validate-media-bytes.ts) recognizes them as genuine audio / image.
const MP3_BYTES = new Uint8Array([0xFF, 0xFB, 0x90, 0x00])
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])

function audio_file() {
  return new File([MP3_BYTES], 'rec.mp3', { type: 'audio/mpeg' })
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
    // Audio bytes land on the R2 key convention: {dict}/audio/{row uuid}.{ext}
    expect(body.audio.storage_path).toBe(`dict-1/audio/${body.audio.id}.mp3`)
    expect(body.audio.speakers).toEqual([{ id: 'sp1', name: 'Ana' }])
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
    expect(dict_db.prepare(`SELECT source FROM audio WHERE entry_id = ?`).get('e1')).toEqual({ source: 'field-2026' })
  })

  test('audio→entry: JSON url fetches bytes server-side', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(MP3_BYTES, { headers: { 'content-type': 'audio/mpeg', 'content-length': '4' } }))))
    const res = await attach_json({ cell: 'audio:entry', params: { entryId: 'e1' }, body: { url: 'https://example.com/sound.mp3', speaker_id: 'sp1' } })
    expect(res.status).toBe(200)
    expect((await res.json()).audio.storage_path).toBeTruthy()
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
  })

  test('415 when a fetched url returns an HTML error page instead of audio', async () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><html><body>404 Not Found</body></html>')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(html, { headers: { 'content-type': 'text/html' } }))))
    await expect(attach_json({ cell: 'audio:entry', params: { entryId: 'e1' }, body: { url: 'https://example.com/missing.mp3', speaker_id: 'sp1' } })).rejects.toMatchObject({ status: 415 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('415 when a multipart file is not real media of this type', async () => {
    const text = new File([new TextEncoder().encode('this is not audio')], 'rec.mp3', { type: 'audio/mpeg' })
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1' }, file: text })).rejects.toMatchObject({ status: 415 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('replace:true removes prior audio on the entry', async () => {
    await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1' } })
    await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1', replace: 'true' } })
    expect(dict_db.prepare(`SELECT COUNT(*) AS c FROM audio WHERE entry_id = ?`).get('e1')).toEqual({ c: 1 })
  })

  test('idempotent id: re-POST is a no-op and does NOT re-upload', async () => {
    const aud_id = '3f0e2a10-9c1d-4d6e-8b2a-5f7c9d1e0a2b'
    const first = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { id: aud_id, speaker_id: 'sp1' } })).json()
    expect(first.created).toBeTruthy()
    const second = await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { id: aud_id, speaker_id: 'sp1' } })
    expect((await second.json()).created).toBeFalsy()
    expect(store_media_bytes).toHaveBeenCalledTimes(1)
    expect(dict_db.prepare(`SELECT COUNT(*) AS c FROM audio`).get()).toEqual({ c: 1 })
  })

  test('400 for a non-uuid caller-supplied id on audio (it becomes the R2 object key)', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { id: 'aud-1', speaker_id: 'sp1' } })).rejects.toMatchObject({ status: 400 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('400 with actionable guidance when audio has neither speaker_id nor source', async () => {
    const err = await Promise.resolve(attach({ cell: 'audio:entry', params: { entryId: 'e1' } })).catch(caught => caught)
    expect(err.status).toBe(400)
    expect(err.body.message).toContain('requires attribution')
    expect(err.body.message).toContain('/api/v1/dictionaries/dict-1/speakers')
    expect(err.body.message).toContain('/api/v1/dictionaries/dict-1/sources')
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('400 for an unknown source slug lists the existing slugs', async () => {
    const err = await Promise.resolve(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { source: 'nope' } })).catch(caught => caught)
    expect(err.status).toBe(400)
    expect(err.body.message).toContain(`unknown source slug 'nope'`)
    expect(err.body.message).toContain('field-2026')
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('404 for an unknown owner (no upload attempted)', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'ghost' } })).rejects.toMatchObject({ status: 404 })
    expect(store_media_bytes).not.toHaveBeenCalled()
  })

  test('400 for an unknown speaker lists the existing speakers', async () => {
    const err = await Promise.resolve(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'ghost' } })).catch(caught => caught)
    expect(err.status).toBe(400)
    expect(err.body.message).toContain(`speaker 'ghost' not found`)
    expect(err.body.message).toContain('Ana (sp1)')
  })

  test('400 when neither file nor url is provided', async () => {
    await expect(attach_json({ cell: 'audio:entry', params: { entryId: 'e1' }, body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('403 for a read-only key', async () => {
    await expect(attach({ cell: 'audio:entry', params: { entryId: 'e1' }, key: read_key })).rejects.toMatchObject({ status: 403 })
  })

  test('photo→sense: multipart upload lands on the R2 photo key + links the junction (no lh3 serving_url)', async () => {
    const res = await attach({ cell: 'photo:sense', params: { senseId: 's1' }, fields: { photographer: 'Sam' }, file: new File([JPEG_BYTES], 'pic.jpg', { type: 'image/jpeg' }) })
    const body = await res.json()
    expect(body.photo.storage_path).toMatch(/^dict-1\/photo\/[0-9a-f-]{36}\.jpg$/)
    expect(body.photo.serving_url).toBe('')
    expect(body.photo.photographer).toBe('Sam')
    const junction = dict_db.prepare(`SELECT 1 FROM sense_photos WHERE sense_id = ? AND photo_id = ?`).get('s1', body.photo.id)
    expect(junction).toBeTruthy()
  })

  test('video→sense: hosted_url (multipart, no file) is parsed to hosted_elsewhere', async () => {
    const res = await attach({ cell: 'video:sense', params: { senseId: 's1' }, fields: { hosted_url: 'https://www.youtube.com/watch?v=GrsknWZpr-k', source: 'field-2026' }, file: null })
    const body = await res.json()
    expect(body.video.hosted_elsewhere).toEqual({ type: 'youtube', video_id: 'GrsknWZpr-k' })
    expect(body.video.hosted_metadata).toEqual({ title: 'YouTube clip', thumbnail_url: 'https://example.com/youtube.jpg' })
    expect(body.video.source).toBe('field-2026')
    expect(store_media_bytes).not.toHaveBeenCalled()
    expect(dict_db.prepare(`SELECT 1 FROM sense_videos WHERE sense_id = ? AND video_id = ?`).get('s1', body.video.id)).toBeTruthy()
  })

  test('video→sense: structured hosted_elsewhere via JSON', async () => {
    const res = await attach_json({ cell: 'video:sense', params: { senseId: 's1' }, body: { hosted_elsewhere: { type: 'vimeo', video_id: '239862299' }, speaker_id: 'sp1' } })
    const { video } = await res.json()
    expect(video.hosted_elsewhere).toEqual({ type: 'vimeo', video_id: '239862299' })
    expect(video.hosted_metadata).toEqual({ title: 'Vimeo film', thumbnail_url: 'https://example.com/vimeo.jpg', duration_seconds: 64 })
  })

  test('metadata failure does not block a valid hosted video', async () => {
    vi.mocked(fetch_hosted_video_metadata).mockResolvedValueOnce(undefined)
    const res = await attach_json({ cell: 'video:sense', params: { senseId: 's1' }, body: { hosted_elsewhere: { type: 'vimeo', video_id: '239862299', start_at_seconds: 18 }, speaker_id: 'sp1' } })
    const { video } = await res.json()
    expect(video.hosted_elsewhere).toEqual({ type: 'vimeo', video_id: '239862299', start_at_seconds: 18 })
    expect(video.hosted_metadata).toBeNull()
  })

  test('400 when a video has neither speaker_id nor source', async () => {
    await expect(attach_json({ cell: 'video:sense', params: { senseId: 's1' }, body: { hosted_elsewhere: { type: 'vimeo', video_id: '239862299' } } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 for an invalid hosted-video start offset', async () => {
    await expect(attach_json({ cell: 'video:sense', params: { senseId: 's1' }, body: { hosted_elsewhere: { type: 'vimeo', video_id: '239862299', start_at_seconds: -1 }, speaker_id: 'sp1' } })).rejects.toMatchObject({ status: 400 })
  })

  test('photo needs no attribution (source stays free-text caption)', async () => {
    const res = await attach({ cell: 'photo:sense', params: { senseId: 's1' }, fields: { source: 'any prose, not a slug' }, file: new File([JPEG_BYTES], 'pic.jpg', { type: 'image/jpeg' }) })
    expect((await res.json()).photo.source).toBe('any prose, not a slug')
  })

  test('audio→sentence: timings accepted as a JSON string in multipart', async () => {
    const timings = { sent1: '0,320|40,280|' }
    const res = await attach({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, fields: { speaker_id: 'sp1', timings: JSON.stringify(timings) } })
    expect(res.status).toBe(200)
    expect((await res.json()).audio.timings).toEqual(timings)
  })

  test('audio→sentence: timings accepted as an object in JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(MP3_BYTES, { headers: { 'content-type': 'audio/mpeg', 'content-length': '4' } }))))
    const res = await attach_json({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, body: { url: 'https://example.com/sound.mp3', speaker_id: 'sp1', timings: { sent1: '0,320|' } } })
    expect((await res.json()).audio.timings).toEqual({ sent1: '0,320|' })
  })

  test('400 for malformed timings (non-string values / broken JSON) — no upload attempted', async () => {
    await expect(attach({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, fields: { speaker_id: 'sp1', timings: '{not json' } })).rejects.toMatchObject({ status: 400 })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(MP3_BYTES, { headers: { 'content-type': 'audio/mpeg', 'content-length': '4' } }))))
    await expect(attach_json({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, body: { url: 'https://example.com/a.mp3', speaker_id: 'sp1', timings: { sent1: 42 } } })).rejects.toMatchObject({ status: 400 })
  })

  test('400 when timings are sent for a non-audio medium', async () => {
    await expect(attach({ cell: 'photo:sense', params: { senseId: 's1' }, fields: { timings: '{}' }, file: new File([JPEG_BYTES], 'pic.jpg', { type: 'image/jpeg' }) })).rejects.toMatchObject({ status: 400 })
  })
})

describe(make_media_timings_patch_handler, () => {
  function patch_timings({ cell, params, body, key = write_key }: { cell: Parameters<typeof make_media_timings_patch_handler>[0], params: Record<string, string>, body: unknown, key?: string }) {
    const handler = make_media_timings_patch_handler(cell)
    const request = new Request('http://localhost/api/v1/media', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
    return handler({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params } } as never)
  }

  test('sets, replaces, and clears timings on an attached sentence audio', async () => {
    const created = await (await attach({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, fields: { speaker_id: 'sp1' } })).json()
    expect(created.audio.timings).toBeNull()

    const set = await (await patch_timings({ cell: 'audio:sentence', params: { sentenceId: 'sent1', audioId: created.audio.id }, body: { timings: { sent1: '0,320|40,280|' } } })).json()
    expect(set.audio.timings).toEqual({ sent1: '0,320|40,280|' })

    const replaced = await (await patch_timings({ cell: 'audio:sentence', params: { sentenceId: 'sent1', audioId: created.audio.id }, body: { timings: { sent1: '10,300|' } } })).json()
    expect(replaced.audio.timings).toEqual({ sent1: '10,300|' })
    expect(dict_db.prepare(`SELECT timings FROM audio WHERE id = ?`).get(created.audio.id)).toEqual({ timings: JSON.stringify({ sent1: '10,300|' }) })

    const cleared = await (await patch_timings({ cell: 'audio:sentence', params: { sentenceId: 'sent1', audioId: created.audio.id }, body: { timings: null } })).json()
    expect(cleared.audio.timings).toBeNull()
  })

  test('404 when the audio is not linked to the owner', async () => {
    const created = await (await attach({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, fields: { speaker_id: 'sp1' } })).json()
    await expect(patch_timings({ cell: 'audio:text', params: { textId: 'ghost', audioId: created.audio.id }, body: { timings: {} } })).rejects.toMatchObject({ status: 404 })
  })

  test('400 without a timings key; 403 for a read key', async () => {
    const created = await (await attach({ cell: 'audio:sentence', params: { sentenceId: 'sent1' }, fields: { speaker_id: 'sp1' } })).json()
    await expect(patch_timings({ cell: 'audio:sentence', params: { sentenceId: 'sent1', audioId: created.audio.id }, body: {} })).rejects.toMatchObject({ status: 400 })
    await expect(patch_timings({ cell: 'audio:sentence', params: { sentenceId: 'sent1', audioId: created.audio.id }, body: { timings: {} }, key: read_key })).rejects.toMatchObject({ status: 403 })
  })
})

describe(make_media_delete_handler, () => {
  function del({ cell, params, key = write_key }: { cell: Parameters<typeof make_media_delete_handler>[0], params: Record<string, string>, key?: string }) {
    const handler = make_media_delete_handler(cell)
    const request = new Request('http://localhost/api/v1/media', { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } })
    return handler({ request, cookies: { get: () => undefined }, params: { id: 'dict-1', ...params } } as never)
  }

  test('deletes an attached audio', async () => {
    const created = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1' } })).json()
    const res = await del({ cell: 'audio:entry', params: { entryId: 'e1', audioId: created.audio.id } })
    expect((await res.json()).result).toBe('deleted')
    expect(dict_db.prepare(`SELECT 1 FROM audio WHERE id = ?`).get(created.audio.id)).toBeUndefined()
  })

  test('404 when the media is not linked to the owner', async () => {
    const created = await (await attach({ cell: 'audio:entry', params: { entryId: 'e1' }, fields: { speaker_id: 'sp1' } })).json()
    await expect(del({ cell: 'audio:entry', params: { entryId: 'ghost', audioId: created.audio.id } })).rejects.toMatchObject({ status: 404 })
  })
})
