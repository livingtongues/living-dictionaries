import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { DELETE, POST } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let write_key: string
let read_key: string
const NOW = '2026-01-01T00:00:00.000Z'

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/server/media-storage', async (orig) => {
  const actual = await orig<typeof import('$lib/server/media-storage')>()
  return { ...actual, store_media_bytes: vi.fn(({ r2_key }: { r2_key: string }) => Promise.resolve({ storage_path: r2_key, bucket: 'bucket', dev_mock: false })) }
})
vi.mock('$lib/server/photo-variants', () => ({ store_photo_variants_in_background: vi.fn() }))
vi.mock('$lib/db/server/media-ledger', () => ({ record_media_object_by_key: vi.fn() }))

// Smallest valid PNG (1×1) — `validate_media_bytes` sniffs magic bytes, and sharp
// reads real dimensions off it.
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

beforeEach(() => {
  vi.clearAllMocks()
  shared_db = open_test_shared_db()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u1', 'u@x.com', 'U', JSON.stringify([]), NOW, NOW)
  shared_db.prepare(`INSERT INTO dictionaries (id, url, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('dict-1', 'mydict', 'My Dictionary', NOW, NOW)
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'u1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'u1' }).token
})

afterEach(() => shared_db.close())

function post_call({ api_key, form, json_body }: { api_key?: string, form?: FormData, json_body?: unknown }) {
  const headers: Record<string, string> = {}
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  let request: Request
  if (form) {
    request = new Request('http://localhost/api/v1/dictionaries/dict-1/cover-image', { method: 'POST', headers, body: form })
  } else {
    headers['content-type'] = 'application/json'
    request = new Request('http://localhost/api/v1/dictionaries/dict-1/cover-image', { method: 'POST', headers, body: JSON.stringify(json_body ?? {}) })
  }
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
}

function image_form(bytes: Buffer = PNG_BYTES, name = 'cover.png', type = 'image/png') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name, { type }))
  return form
}

function stored_featured_image() {
  const row = shared_db.prepare(`SELECT featured_image FROM dictionaries WHERE id = 'dict-1'`).get() as { featured_image: string | null }
  return row.featured_image ? JSON.parse(row.featured_image) : null
}

describe(POST, () => {
  test('401 without a credential', async () => {
    await expect(post_call({ form: image_form() })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a read-scope key', async () => {
    await expect(post_call({ api_key: read_key, form: image_form() })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when no image is provided', async () => {
    await expect(post_call({ api_key: write_key, json_body: {} })).rejects.toMatchObject({ status: 400 })
  })

  test('415 when the bytes are not an image', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array(Buffer.from('not an image at all'))], 'cover.png', { type: 'image/png' }))
    await expect(post_call({ api_key: write_key, form })).rejects.toMatchObject({ status: 415 })
  })

  test('stores the bytes under the photo key convention and sets featured_image with dimensions', async () => {
    const res = await post_call({ api_key: write_key, form: image_form() })
    expect(res.status).toBe(200)
    const { featured_image } = await res.json()
    expect(featured_image.storage_path).toMatch(/^dict-1\/photo\/[0-9a-f-]{36}\.png$/)
    expect(featured_image).toMatchObject({ width: 1, height: 1 })
    expect(stored_featured_image()).toEqual(featured_image)
  })

  test('generates the webp variants behind the response', async () => {
    const { store_photo_variants_in_background } = await import('$lib/server/photo-variants')
    await post_call({ api_key: write_key, form: image_form() })
    expect(store_photo_variants_in_background).toHaveBeenCalledOnce()
  })

  test('a second upload replaces the first', async () => {
    const first = await (await post_call({ api_key: write_key, form: image_form() })).json()
    const second = await (await post_call({ api_key: write_key, form: image_form() })).json()
    expect(second.featured_image.storage_path).not.toBe(first.featured_image.storage_path)
    expect(stored_featured_image()).toEqual(second.featured_image)
  })
})

describe(DELETE, () => {
  function delete_call({ api_key }: { api_key?: string }) {
    const headers: Record<string, string> = {}
    if (api_key)
      headers.Authorization = `Bearer ${api_key}`
    const request = new Request('http://localhost/api/v1/dictionaries/dict-1/cover-image', { method: 'DELETE', headers })
    return DELETE({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' } } as never)
  }

  test('403 for a read-scope key', async () => {
    await expect(delete_call({ api_key: read_key })).rejects.toMatchObject({ status: 403 })
  })

  test('clears featured_image', async () => {
    await post_call({ api_key: write_key, form: image_form() })
    const res = await delete_call({ api_key: write_key })
    expect(await res.json()).toEqual({ featured_image: null })
    expect(stored_featured_image()).toBe(null)
  })
})
