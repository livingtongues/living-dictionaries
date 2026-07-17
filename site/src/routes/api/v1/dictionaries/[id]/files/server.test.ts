import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { sign_jwt } from '$lib/auth/jwt'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { GET as GET_FILE, PATCH } from './[file_id]/+server'
import { POST as REQUEST_IMPORT } from './request-import/+server'
import { GET, POST } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let api_token: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
// The presign path needs R2 creds — pretend they exist and stub the signer.
vi.mock('$lib/r2/import-files', async orig => ({
  ...(await orig<typeof import('$lib/r2/import-files')>()),
  r2_is_configured: () => true,
  presign_import_upload: ({ key }: { key: string }) => Promise.resolve(`https://r2.example/put/${key}`),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  process.env.NTFY_DISABLED = '1'
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  const at = '2026-01-01T00:00:00Z'
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mgr-1', 'mgr@x.com', 'Mgr', JSON.stringify([]), at, at)
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('con-1', 'con@x.com', 'Con', JSON.stringify([]), at, at)
  shared_db.prepare(`INSERT INTO dictionaries (id, url, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('dict-1', 'dict-one', 'Dict One', at, at)
  shared_db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r-mgr', 'dict-1', 'mgr-1', 'manager', at, at)
  shared_db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r-con', 'dict-1', 'con-1', 'contributor', at, at)
  api_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'agent', role: 'write', created_by_user_id: 'mgr-1' }).token
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
})

function event({ handler, token, api_key, body, file_id }: { handler: 'list' | 'create' | 'patch' | 'request' | 'download', token?: string, api_key?: string, body?: unknown, file_id?: string }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/files', {
    method: handler === 'list' || handler === 'download' ? 'GET' : 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers,
  })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return { request, cookies, params: { id: 'dict-1', file_id }, url: new URL('http://localhost/api/v1/dictionaries/dict-1/files') } as never
}

function manager_token() {
  return sign_jwt({ sub: 'mgr-1', email: 'mgr@x.com', name: 'Mgr' })
}
function contributor_token() {
  return sign_jwt({ sub: 'con-1', email: 'con@x.com', name: 'Con' })
}

async function register_file(overrides: Record<string, unknown> = {}) {
  const response = await POST(event({ handler: 'create', token: await manager_token(), body: { filename: 'scan.pdf', mimetype: 'application/pdf', size_bytes: 1234, ...overrides } }))
  return (await response.json()).file
}

describe(POST, () => {
  test('401 with no credentials', async () => {
    await expect(POST(event({ handler: 'create', body: { filename: 'a.pdf', mimetype: 'application/pdf', size_bytes: 5 } })))
      .rejects.toMatchObject({ status: 401 })
  })

  test('403 for a contributor — files are manager-scope', async () => {
    await expect(POST(event({ handler: 'create', token: await contributor_token(), body: { filename: 'a.pdf', mimetype: 'application/pdf', size_bytes: 5 } })))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 over the 100MB cap', async () => {
    await expect(POST(event({ handler: 'create', token: await manager_token(), body: { filename: 'big.pdf', mimetype: 'application/pdf', size_bytes: 101 * 1024 * 1024 } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('manager registers a file and gets a presigned url; row is pending', async () => {
    const response = await POST(event({ handler: 'create', token: await manager_token(), body: { filename: 'scan.pdf', mimetype: 'application/pdf', size_bytes: 1234 } }))
    const data = await response.json()
    expect(data.upload_url).toBe(`https://r2.example/put/import/dict-1/${data.file.id}`)
    expect(data.file.upload_confirmed_at).toBe(null)
    const row = shared_db.prepare('SELECT * FROM source_files WHERE id = ?').get(data.file.id) as { storage_key: string, uploaded_by_user_id: string }
    expect(row.storage_key).toBe(`import/dict-1/${data.file.id}`)
    expect(row.uploaded_by_user_id).toBe('mgr-1')
  })

  test('a write-scoped API key can register files too', async () => {
    const response = await POST(event({ handler: 'create', api_key: api_token, body: { filename: 'list.csv', mimetype: 'text/csv', size_bytes: 10 } }))
    expect(response.status).toBe(200)
  })
})

describe(GET, () => {
  test('lists this dictionary\'s files for a manager', async () => {
    await register_file()
    const response = await GET(event({ handler: 'list', token: await manager_token() }))
    expect((await response.json()).files).toHaveLength(1)
  })

  test('403 for a contributor', async () => {
    await expect(GET(event({ handler: 'list', token: await contributor_token() })))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe(PATCH, () => {
  test('updates instructions; rejects an unknown source_id; links a real one', async () => {
    const file = await register_file()
    const response = await PATCH(event({ handler: 'patch', token: await manager_token(), file_id: file.id, body: { import_instructions: 'Only import nouns' } }))
    expect((await response.json()).file.import_instructions).toBe('Only import nouns')

    await expect(PATCH(event({ handler: 'patch', token: await manager_token(), file_id: file.id, body: { source_id: 'nope' } })))
      .rejects.toMatchObject({ status: 400 })

    dict_db.prepare(`INSERT INTO sources (id, slug, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES ('src-1', 'smith-1979', 'mgr-1', '2026-01-01', 'mgr-1', '2026-01-01')`).run()
    const linked = await PATCH(event({ handler: 'patch', token: await manager_token(), file_id: file.id, body: { source_id: 'src-1' } }))
    expect((await linked.json()).file.source_id).toBe('src-1')
  })

  test('404 for a file on another dictionary', async () => {
    await expect(PATCH(event({ handler: 'patch', token: await manager_token(), file_id: 'missing', body: { source_note: 'x' } })))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe(REQUEST_IMPORT, () => {
  test('400 when a file has no instructions or is unconfirmed', async () => {
    const file = await register_file()
    await expect(REQUEST_IMPORT(event({ handler: 'request', token: await manager_token(), body: { file_ids: [file.id] } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('creates an assigned thread with an agent-ready body and stamps the files', async () => {
    // Diego needs a users row for the deterministic assignment.
    shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('u-diego', 'diego@livingtongues.org', 'Diego', JSON.stringify([]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
    const file = await register_file()
    shared_db.prepare(`UPDATE source_files SET upload_confirmed_at = '2026-07-17T00:00:00Z', import_instructions = 'Import all entries; skip the intro pages.' WHERE id = ?`).run(file.id)

    const response = await REQUEST_IMPORT(event({ handler: 'request', token: await manager_token(), body: { file_ids: [file.id], message: 'This is a 1979 published dictionary.' } }))
    const { thread_id } = await response.json()

    const thread = shared_db.prepare('SELECT * FROM message_threads WHERE id = ?').get(thread_id) as Record<string, string>
    expect(thread.subject).toBe('Import request: Dict One')
    expect(thread.dictionary_id).toBe('dict-1')
    expect(thread.from_user_id).toBe('mgr-1')
    expect(thread.assigned_to_user_id).toBe('u-diego')

    const message = shared_db.prepare('SELECT body_text FROM messages WHERE thread_id = ?').get(thread_id) as { body_text: string }
    expect(message.body_text).toContain(`Download: http://localhost/api/v1/dictionaries/dict-1/files/${file.id}`)
    expect(message.body_text).toContain('Import all entries; skip the intro pages.')
    expect(message.body_text).toContain('This is a 1979 published dictionary.')
    expect(message.body_text).toContain('/api/v1/guides/importing')
    expect(message.body_text).toContain('Dictionary id: dict-1')

    const stamped = shared_db.prepare('SELECT import_requested_at, import_thread_id FROM source_files WHERE id = ?').get(file.id) as Record<string, string>
    expect(stamped.import_thread_id).toBe(thread_id)
    expect(stamped.import_requested_at).toBeTruthy()

    // Re-requesting the same file fails.
    await expect(REQUEST_IMPORT(event({ handler: 'request', token: await manager_token(), body: { file_ids: [file.id] } })))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe(GET_FILE, () => {
  test('404 for a missing file id', async () => {
    await expect(GET_FILE(event({ handler: 'download', token: await manager_token(), file_id: 'missing' })))
      .rejects.toMatchObject({ status: 404 })
  })
})
