import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as inbound_hook_module from '$lib/agent/email-inbound-hook'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import * as notify_module from '$lib/notifications/notify-admins'
import { POST } from './+server'
import type { MessagesEmailInboundRequestBody } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

vi.mock('$lib/agent/email-inbound-hook', () => ({ fire_agent_email_inbound: vi.fn() }))
vi.mock('$lib/server/log-server-event', () => ({ log_server_event: vi.fn() }))
vi.mock('$env/dynamic/private', () => ({ env: { INTERNAL_INGEST_SECRET: 'test-secret' } }))

// Default ntfy off so notify_admins is a no-op unless a test spies on it.
vi.stubEnv('NTFY_DISABLED', '1')

const JACOB_EMAIL = 'jwrunner7@gmail.com'
const DIEGO_EMAIL = 'diego@livingtongues.org'

beforeEach(() => {
  db = open_test_shared_db()
  vi.mocked(inbound_hook_module.fire_agent_email_inbound).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  db.close()
})

function call(body: unknown, headers: Record<string, string> = {}) {
  const request = new Request('http://localhost/api/messages/email-inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0])
}

function valid_payload(overrides: Partial<MessagesEmailInboundRequestBody> = {}): MessagesEmailInboundRequestBody {
  return {
    message_id: '<msg-1@gmail.com>',
    in_reply_to: null,
    email_references: [],
    from_email: 'customer@example.com',
    from_name: 'Customer Person',
    to_email: 'support@livingdictionaries.app',
    subject: 'Question about Turoyo',
    body_text: 'I have a question about my dictionary.',
    body_html: null,
    raw_headers: '{"Subject":"Question about Turoyo"}',
    received_at: '2026-05-12T10:00:00.000Z',
    attachments: [],
    ...overrides,
  }
}

function seed_admin(id: string, email: string) {
  db.prepare(`INSERT INTO users (id, email, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, email, '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
}

/** Seed a thread via a first inbound message, returning its thread_id. */
async function seed_thread() {
  const response = await call(valid_payload({ message_id: '<original@gmail.com>' }), { 'x-internal-secret': 'test-secret' })
  return (await response.json()).thread_id as string
}

describe(POST, () => {
  test('re-opens a resolved + read + replied thread when the customer replies', async () => {
    const thread_id = await seed_thread()
    seed_admin('u-admin', JACOB_EMAIL)
    db.prepare(`UPDATE message_threads SET resolved_at = ?, resolved_by_user_id = ?, read_at = ?, replied_at = ?, replied_by_user_id = ? WHERE id = ?`)
      .run('2026-05-12T10:30:00.000Z', 'u-admin', '2026-05-12T10:30:00.000Z', '2026-05-12T10:30:00.000Z', 'u-admin', thread_id)

    await call(
      valid_payload({ message_id: '<reply@gmail.com>', in_reply_to: '<original@gmail.com>', received_at: '2026-05-12T12:00:00.000Z' }),
      { 'x-internal-secret': 'test-secret' },
    )

    const thread = db.prepare(`SELECT resolved_at, resolved_by_user_id, replied_at, replied_by_user_id, read_at, last_message_at FROM message_threads WHERE id = ?`)
      .get(thread_id) as Record<string, string | null>
    expect(thread.resolved_at).toBeNull()
    expect(thread.resolved_by_user_id).toBeNull()
    expect(thread.replied_at).toBeNull()
    expect(thread.replied_by_user_id).toBeNull()
    expect(thread.read_at).toBeNull()
    expect(thread.last_message_at).toBe('2026-05-12T12:00:00.000Z')
  })

  test('reply on an assigned thread pings the ASSIGNEE (not the alias it was sent to)', async () => {
    const thread_id = await seed_thread()
    seed_admin('u-jacob', JACOB_EMAIL)
    seed_admin('u-diego', DIEGO_EMAIL)
    // Thread is assigned to Diego; customer replies to jacob@ (Jacob's alias).
    db.prepare(`UPDATE message_threads SET assigned_to_user_id = 'u-diego', resolved_at = ?, resolved_by_user_id = 'u-diego' WHERE id = ?`)
      .run('2026-05-12T10:30:00.000Z', thread_id)

    // Spy AFTER seeding so only the reply's notifications are captured.
    const one = vi.spyOn(notify_module, 'notify_admin').mockResolvedValue()
    const all = vi.spyOn(notify_module, 'notify_admins').mockResolvedValue()

    await call(
      valid_payload({ message_id: '<reply@gmail.com>', in_reply_to: '<original@gmail.com>', to_email: 'jacob@livingdictionaries.app' }),
      { 'x-internal-secret': 'test-secret' },
    )

    expect(one).toHaveBeenCalledTimes(1)
    expect(one.mock.calls[0][0].email).toBe(DIEGO_EMAIL)
    expect(all).not.toHaveBeenCalled()
    // Assignment must NOT be re-routed to the alias admin.
    const thread = db.prepare(`SELECT assigned_to_user_id FROM message_threads WHERE id = ?`).get(thread_id) as { assigned_to_user_id: string }
    expect(thread.assigned_to_user_id).toBe('u-diego')
  })

  test('directed new mail (to an admin alias) assigns + pings ONLY that admin', async () => {
    seed_admin('u-jacob', JACOB_EMAIL)
    const one = vi.spyOn(notify_module, 'notify_admin').mockResolvedValue()
    const all = vi.spyOn(notify_module, 'notify_admins').mockResolvedValue()

    const response = await call(
      valid_payload({ to_email: 'jacob@livingdictionaries.app' }),
      { 'x-internal-secret': 'test-secret' },
    )
    const body = await response.json()

    const thread = db.prepare(`SELECT assigned_to_user_id FROM message_threads WHERE id = ?`).get(body.thread_id) as { assigned_to_user_id: string }
    expect(thread.assigned_to_user_id).toBe('u-jacob')
    expect(one).toHaveBeenCalledTimes(1)
    expect(one.mock.calls[0][0].email).toBe(JACOB_EMAIL)
    expect(all).not.toHaveBeenCalled()
  })

  test('reply on an UNASSIGNED thread via a generic alias broadcasts to the team', async () => {
    const thread_id = await seed_thread()
    db.prepare(`UPDATE message_threads SET resolved_at = ? WHERE id = ?`).run('2026-05-12T10:30:00.000Z', thread_id)

    // Spy AFTER seeding so only the reply's notifications are captured.
    const one = vi.spyOn(notify_module, 'notify_admin').mockResolvedValue()
    const all = vi.spyOn(notify_module, 'notify_admins').mockResolvedValue()

    await call(
      valid_payload({ message_id: '<reply@gmail.com>', in_reply_to: '<original@gmail.com>', to_email: 'support@livingdictionaries.app' }),
      { 'x-internal-secret': 'test-secret' },
    )

    expect(all).toHaveBeenCalledTimes(1)
    expect(one).not.toHaveBeenCalled()
  })
})
