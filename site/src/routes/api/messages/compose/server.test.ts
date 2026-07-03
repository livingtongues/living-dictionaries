import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SendRawEmailParts } from '$lib/email/send-raw-email'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

const { send_raw_email_mock, put_attachment_mock } = vi.hoisted(() => ({
  send_raw_email_mock: vi.fn(),
  put_attachment_mock: vi.fn(),
}))
vi.mock('$lib/email/send-raw-email', () => ({ send_raw_email: send_raw_email_mock }))
vi.mock('$lib/r2/put-attachment', () => ({ put_attachment: put_attachment_mock }))

const ADMIN_EMAIL = 'jwrunner7@gmail.com'
const ADMIN_USER_ID = 'admin-user-id'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

function admin_token() {
  return sign_jwt({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL, name: 'Jacob' })
}
function non_admin_token() {
  return sign_jwt({ sub: 'random-user-id', email: 'random@example.com', name: 'Random' })
}

function call(body: unknown, options: { token?: string } = {}) {
  const request = new Request('http://localhost/api/messages/compose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

function seed_user({ id = 'user-1', email = 'customer@example.com', name = 'Cathy Customer' }: { id?: string, email?: string | null, name?: string | null } = {}) {
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email, name, JSON.stringify([{ provider: 'email', provider_id: email }]), now, now)
}

beforeEach(() => {
  db = open_shared_db(':memory:')
  // Admin's own users row (created lazily on first OTP login in prod) — needed
  // so messages.author_user_id / threads.replied_by_user_id FKs resolve.
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ADMIN_USER_ID, ADMIN_EMAIL, 'Jacob', JSON.stringify([{ provider: 'email', provider_id: ADMIN_EMAIL }]), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  send_raw_email_mock.mockReset().mockResolvedValue({ ses_message_id: 'ses-1' })
  put_attachment_mock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  db.close()
})

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello' })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a non-admin', async () => {
    await expect(call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello' }, { token: await non_admin_token() })).rejects.toMatchObject({ status: 403 })
  })

  test('400 when required fields are missing', async () => {
    const token = await admin_token()
    // no recipients
    await expect(call({ subject: 'Hi', body_text: 'hello' }, { token })).rejects.toMatchObject({ status: 400 })
    // empty recipients
    await expect(call({ recipients: [], subject: 'Hi', body_text: 'hello' }, { token })).rejects.toMatchObject({ status: 400 })
    // no subject
    await expect(call({ recipients: [{ user_id: 'user-1' }], body_text: 'hello' }, { token })).rejects.toMatchObject({ status: 400 })
    // no body
    await expect(call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi' }, { token })).rejects.toMatchObject({ status: 400 })
  })

  test('unknown user → per-recipient failure (no thread), not a hard error', async () => {
    const response = await call({ recipients: [{ user_id: 'ghost' }], subject: 'Hi', body_text: 'hello' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.results).toHaveLength(1)
    expect(data.results[0].delivery_status).toBe('failed')
    expect(data.results[0].thread_id).toBeNull()
    expect(data.results[0].delivery_error).toContain('User not found')
    expect(send_raw_email_mock).not.toHaveBeenCalled()
  })

  test('invalid typed email → per-recipient failure (no thread)', async () => {
    const response = await call({ recipients: [{ email: 'not-an-email' }], subject: 'Hi', body_text: 'hello' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.results[0].delivery_status).toBe('failed')
    expect(data.results[0].thread_id).toBeNull()
    expect(data.results[0].delivery_error).toContain('Invalid email')
    expect(send_raw_email_mock).not.toHaveBeenCalled()
  })

  test('blocked recipient → per-recipient failure (no thread)', async () => {
    seed_user({ email: 'no-reply@example.com' })
    const response = await call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.results[0].delivery_status).toBe('failed')
    expect(data.results[0].thread_id).toBeNull()
    expect(data.results[0].delivery_error).toContain('blocked')
    expect(send_raw_email_mock).not.toHaveBeenCalled()
  })

  test('happy path: creates thread + sent message, sends from admin ld address', async () => {
    seed_user()
    const response = await call({ recipients: [{ user_id: 'user-1' }], subject: 'Following up', body_text: 'Hi there', body_html: '<p>Hi <strong>there</strong></p>' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.results).toHaveLength(1)
    const [result] = data.results
    expect(result.delivery_status).toBe('sent')

    const thread = db.prepare('SELECT * FROM message_threads WHERE id = ?').get(result.thread_id) as { source: string, from_user_id: string, from_email: string, replied_by_user_id: string, replied_at: string | null }
    expect(thread.source).toBe('email')
    expect(thread.from_user_id).toBe('user-1')
    expect(thread.from_email).toBe('customer@example.com')
    expect(thread.replied_by_user_id).toBe(ADMIN_USER_ID)
    expect(thread.replied_at).not.toBeNull()

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.message_id) as { author_kind: string, delivery_status: string, body_html: string, message_id: string }
    expect(message.author_kind).toBe('admin')
    expect(message.delivery_status).toBe('sent')
    expect(message.body_html).toBe('<p>Hi <strong>there</strong></p>')

    expect(send_raw_email_mock).toHaveBeenCalledTimes(1)
    const [sent] = send_raw_email_mock.mock.calls[0] as [SendRawEmailParts]
    expect(sent.from).toEqual({ email: 'jacob@livingdictionaries.app', name: 'Jacob Bowdoin' })
    expect(sent.to).toEqual({ email: 'customer@example.com', name: 'Cathy Customer' })
    expect(sent.message_id).toBe(message.message_id)
  })

  test('multiple recipients → one thread + one send each, cc applied to every send', async () => {
    seed_user()
    seed_user({ id: 'user-2', email: 'second@example.com', name: 'Second Sam' })
    const response = await call({
      recipients: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      subject: 'Announcement',
      body_text: 'Hi all',
      cc: ['annaluisa@livingdictionaries.app'],
    }, { token: await admin_token() })
    const data = await response.json()
    expect(data.results).toHaveLength(2)
    expect(data.results.map((r: { delivery_status: string }) => r.delivery_status)).toEqual(['sent', 'sent'])

    const threads = data.results.map((r: { thread_id: string }) => r.thread_id)
    expect(new Set(threads).size).toBe(2)
    expect(send_raw_email_mock).toHaveBeenCalledTimes(2)
    const tos = send_raw_email_mock.mock.calls.map(([parts]) => (parts as SendRawEmailParts).to.email)
    expect(new Set(tos)).toEqual(new Set(['customer@example.com', 'second@example.com']))
    for (const [parts] of send_raw_email_mock.mock.calls)
      expect((parts as SendRawEmailParts).cc).toEqual([{ email: 'annaluisa@livingdictionaries.app' }])
  })

  test('dedupes the same recipient', async () => {
    seed_user()
    const response = await call({
      recipients: [{ user_id: 'user-1' }, { user_id: 'user-1' }, { email: 'customer@example.com' }],
      subject: 'Hi',
      body_text: 'hello',
    }, { token: await admin_token() })
    const data = await response.json()
    expect(data.results).toHaveLength(1)
    expect(send_raw_email_mock).toHaveBeenCalledTimes(1)
  })

  test('partial failure: one sends, one fails', async () => {
    seed_user()
    seed_user({ id: 'user-2', email: 'second@example.com', name: 'Second Sam' })
    send_raw_email_mock.mockReset()
    send_raw_email_mock.mockResolvedValueOnce({ ses_message_id: 'ok' })
    send_raw_email_mock.mockRejectedValueOnce(new Error('SES boom'))
    const response = await call({
      recipients: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      subject: 'Hi',
      body_text: 'hello',
    }, { token: await admin_token() })
    const data = await response.json()
    expect(data.results).toHaveLength(2)
    expect(data.results[0].delivery_status).toBe('sent')
    expect(data.results[1].delivery_status).toBe('failed')
    expect(data.results[1].delivery_error).toContain('SES boom')
    // The failed send still created a (retryable) thread.
    expect(data.results[1].thread_id).not.toBeNull()
    const message = db.prepare('SELECT delivery_status FROM messages WHERE id = ?').get(data.results[1].message_id) as { delivery_status: string }
    expect(message.delivery_status).toBe('failed')
  })

  test('persists attachments to R2 + message_attachments and forwards to SES', async () => {
    seed_user()
    const content_b64 = Buffer.from('PDF BYTES').toString('base64')
    const response = await call({
      recipients: [{ user_id: 'user-1' }],
      subject: 'Doc',
      body_text: 'see attached',
      attachments: [{ filename: 'doc.pdf', mimetype: 'application/pdf', content_b64 }],
    }, { token: await admin_token() })
    const data = await response.json()
    expect(put_attachment_mock).toHaveBeenCalledTimes(1)

    const att = db.prepare('SELECT * FROM message_attachments WHERE message_id = ?').get(data.results[0].message_id) as { filename: string, mimetype: string, size_bytes: number, storage_key: string, id: string, disposition: string }
    expect(att.filename).toBe('doc.pdf')
    expect(att.mimetype).toBe('application/pdf')
    expect(att.size_bytes).toBe(Buffer.from('PDF BYTES').byteLength)
    expect(att.storage_key).toBe(att.id) // storage_key === R2 object key === row id
    expect(att.disposition).toBe('attachment')

    const [sent] = send_raw_email_mock.mock.calls[0] as [SendRawEmailParts]
    expect(sent.attachments).toHaveLength(1)
    expect(sent.attachments[0].filename).toBe('doc.pdf')
  })

  test('records delivery_status=failed (and does not throw) when SES rejects', async () => {
    seed_user()
    send_raw_email_mock.mockRejectedValueOnce(new Error('SES throttled'))
    const response = await call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.results[0].delivery_status).toBe('failed')
    expect(data.results[0].delivery_error).toContain('SES throttled')
    const message = db.prepare('SELECT delivery_status FROM messages WHERE id = ?').get(data.results[0].message_id) as { delivery_status: string }
    expect(message.delivery_status).toBe('failed')
  })

  test('compose to typed email creates thread with null from_user_id', async () => {
    const response = await call({ recipients: [{ email: 'stranger@example.com' }], subject: 'Hello', body_text: 'Hi there' }, { token: await admin_token() })
    expect(response.status).toBe(200)
    const data = await response.json()
    const thread = db.prepare('SELECT from_user_id, from_email FROM message_threads WHERE id = ?').get(data.results[0].thread_id) as { from_user_id: string | null, from_email: string }
    expect(thread.from_user_id).toBeNull()
    expect(thread.from_email).toBe('stranger@example.com')
    const [sent] = send_raw_email_mock.mock.calls[0] as [SendRawEmailParts]
    expect(sent.to.email).toBe('stranger@example.com')
  })

  test('passes cc + bcc through', async () => {
    seed_user()
    await call({
      recipients: [{ user_id: 'user-1' }],
      subject: 'Hi',
      body_text: 'hello',
      cc: ['annaluisa@livingdictionaries.app'],
      bcc: ['archive@example.com'],
    }, { token: await admin_token() })
    const [sent] = send_raw_email_mock.mock.calls[0] as [SendRawEmailParts]
    expect(sent.cc).toEqual([{ email: 'annaluisa@livingdictionaries.app' }])
    expect(sent.bcc).toEqual([{ email: 'archive@example.com' }])
  })

  test('persists cc + bcc (comma-joined) on the message row', async () => {
    seed_user()
    const response = await call({
      recipients: [{ user_id: 'user-1' }],
      subject: 'Hi',
      body_text: 'hello',
      cc: ['annaluisa@livingdictionaries.app', 'greg@livingdictionaries.app'],
      bcc: ['archive@example.com'],
    }, { token: await admin_token() })
    const data = await response.json()
    const message = db.prepare('SELECT cc, bcc FROM messages WHERE id = ?').get(data.results[0].message_id) as { cc: string | null, bcc: string | null }
    expect(message.cc).toBe('annaluisa@livingdictionaries.app, greg@livingdictionaries.app')
    expect(message.bcc).toBe('archive@example.com')
  })

  test('marks the thread resolved by default', async () => {
    seed_user()
    const response = await call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello' }, { token: await admin_token() })
    const data = await response.json()
    const thread = db.prepare('SELECT resolved_at, resolved_by_user_id FROM message_threads WHERE id = ?').get(data.results[0].thread_id) as { resolved_at: string | null, resolved_by_user_id: string | null }
    expect(thread.resolved_at).not.toBeNull()
    expect(thread.resolved_by_user_id).toBe(ADMIN_USER_ID)
  })

  test('leaves the thread unresolved when resolve is false', async () => {
    seed_user()
    const response = await call({ recipients: [{ user_id: 'user-1' }], subject: 'Hi', body_text: 'hello', resolve: false }, { token: await admin_token() })
    const data = await response.json()
    const thread = db.prepare('SELECT resolved_at, resolved_by_user_id, replied_at FROM message_threads WHERE id = ?').get(data.results[0].thread_id) as { resolved_at: string | null, resolved_by_user_id: string | null, replied_at: string | null }
    expect(thread.resolved_at).toBeNull()
    expect(thread.resolved_by_user_id).toBeNull()
    // still flags replied (admin authored a message)
    expect(thread.replied_at).not.toBeNull()
  })
})
