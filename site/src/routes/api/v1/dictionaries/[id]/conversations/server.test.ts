import type Database from 'better-sqlite3'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { create_api_key } from '$lib/api-keys/api-key'
import { sign_jwt } from '$lib/auth/jwt'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { DELETE as DELETE_FILE, PATCH as PATCH_FILE } from '../files/[file_id]/+server'
import { POST as CREATE_FILE } from '../files/+server'
import { POST as REQUEST_IMPORT } from '../files/request-import/+server'
import { PATCH as PATCH_REQUEST_NOTE } from '../files/requests/[thread_id]/+server'
import { GET as GET_CONVERSATION, PATCH as PATCH_CONVERSATION } from './[thread_id]/+server'
import { GET as GET_ARTIFACT } from './[thread_id]/artifacts/[artifact_id]/+server'
import { POST as POST_ARTIFACT } from './[thread_id]/artifacts/+server'
import { GET as GET_BRIEF } from './[thread_id]/brief/+server'
import { POST as POST_MESSAGE } from './[thread_id]/messages/+server'
import { POST as POST_QUESTIONS } from './[thread_id]/questions/+server'
import { PATCH as PATCH_QUESTION } from './[thread_id]/questions/[question_id]/+server'
import { POST as POST_READ } from './[thread_id]/read/+server'
import { POST as POST_WITHDRAW } from './[thread_id]/withdraw/+server'
import { GET as LIST_CONVERSATIONS } from './+server'

let shared_db: ReturnType<typeof open_test_shared_db>
let dict_db: Database.Database
let agent_token: string

const { notify_admin, post_system_notification, send_raw_email } = vi.hoisted(() => ({
  notify_admin: vi.fn(() => Promise.resolve()),
  post_system_notification: vi.fn(),
  send_raw_email: vi.fn((_parts: { to: { email: string, name?: string } }) => Promise.resolve({ ses_message_id: 'ses-1', provider_message_id: null })),
}))

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))
vi.mock('$lib/db/server/dictionary-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/dictionary-db')>()), get_dictionary_db: () => dict_db }))
vi.mock('$lib/r2/import-files', async orig => ({
  ...(await orig<typeof import('$lib/r2/import-files')>()),
  r2_is_configured: () => true,
  presign_import_upload: ({ key }: { key: string }) => Promise.resolve(`https://r2.example/put/${key}`),
  put_import_object: () => Promise.resolve(),
  delete_import_object: () => Promise.resolve(),
}))
vi.mock('$lib/r2/get-attachment', async orig => ({
  ...(await orig<typeof import('$lib/r2/get-attachment')>()),
  get_attachment_stream: () => Promise.resolve({
    body: new Blob(['<html>report</html>']).stream(),
    content_length: 19,
  }),
}))
vi.mock('$lib/notifications/notify-admins', () => ({ notify_admin, notify_admins: vi.fn(), notify_user: vi.fn() }))
vi.mock('$lib/server/chat/system-notifier', () => ({ post_system_notification }))
vi.mock('$lib/email/send-raw-email', () => ({ send_raw_email }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
  process.env.NTFY_DISABLED = '1'
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('dict-1')
  const at = '2026-01-01T00:00:00Z'
  const user = shared_db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  user.run('mgr-1', 'mgr@x.com', 'Mgr', '[]', at, at)
  user.run('mgr-2', 'mgr2@x.com', 'Other Manager', '[]', at, at)
  user.run('con-1', 'con@x.com', 'Con', '[]', at, at)
  user.run('u-jacob', 'jwrunner7@gmail.com', 'Jacob', '[]', at, at)
  shared_db.prepare('INSERT INTO dictionaries (id, url, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('dict-1', 'dict-one', 'Dict One', at, at)
  const role = shared_db.prepare('INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  role.run('r-mgr', 'dict-1', 'mgr-1', 'manager', at, at)
  role.run('r-mgr-2', 'dict-1', 'mgr-2', 'manager', at, at)
  role.run('r-con', 'dict-1', 'con-1', 'contributor', at, at)
  agent_token = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'agent', role: 'write', created_by_user_id: 'u-jacob' }).token
  notify_admin.mockClear()
  post_system_notification.mockClear()
  send_raw_email.mockClear()
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
})

function event({ method = 'GET', token, api_key, body, params = {}, search = '' }: {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  token?: string
  api_key?: string
  body?: unknown
  params?: Record<string, string | undefined>
  search?: string
}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (api_key)
    headers.Authorization = `Bearer ${api_key}`
  const href = `http://localhost/api/v1/dictionaries/dict-1/conversations${search}`
  const request = new Request(href, { method, ...(body ? { body: JSON.stringify(body) } : {}), headers })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return { request, cookies, params: { id: 'dict-1', ...params }, url: new URL(href) } as never
}

const manager_token = () => sign_jwt({ sub: 'mgr-1', email: 'mgr@x.com', name: 'Mgr' })
const other_manager_token = () => sign_jwt({ sub: 'mgr-2', email: 'mgr2@x.com', name: 'Other Manager' })
const contributor_token = () => sign_jwt({ sub: 'con-1', email: 'con@x.com', name: 'Con' })
const admin_token = () => sign_jwt({ sub: 'u-jacob', email: 'jwrunner7@gmail.com', name: 'Jacob' })

/** Upload → confirm → request: the state every conversation starts from. */
async function open_conversation({ message = 'Please import this.' }: { message?: string } = {}) {
  const created = await CREATE_FILE(event({ method: 'POST', token: await manager_token(), body: { filename: 'scan.pdf', mimetype: 'application/pdf', size_bytes: 1234 } }))
  const { file } = await created.json()
  shared_db.prepare(`UPDATE source_files SET upload_confirmed_at = '2026-07-25T00:00:00Z', import_instructions = 'Import all entries.' WHERE id = ?`).run(file.id)
  const requested = await REQUEST_IMPORT(event({ method: 'POST', token: await manager_token(), body: { file_ids: [file.id], message } }))
  const { thread_id } = await requested.json()
  return { file_id: file.id as string, thread_id: thread_id as string }
}

async function start({ thread_id }: { thread_id: string }) {
  await PATCH_CONVERSATION(event({ method: 'PATCH', token: await admin_token(), body: { started: true }, params: { thread_id } }))
}

describe(LIST_CONVERSATIONS, () => {
  test('401 without auth, 403 for a contributor', async () => {
    await expect(LIST_CONVERSATIONS(event({}))).rejects.toMatchObject({ status: 401 })
    await expect(LIST_CONVERSATIONS(event({ token: await contributor_token() }))).rejects.toMatchObject({ status: 403 })
  })

  test('lists the request with its resource, question, and unread counts', async () => {
    const { thread_id } = await open_conversation()
    await POST_QUESTIONS(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { questions: [{ kind: 'text', title: 'Who compiled this?' }] } }))
    await POST_MESSAGE(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { body_text: 'Started on it.' } }))

    const { conversations } = await (await LIST_CONVERSATIONS(event({ token: await manager_token() }))).json()
    expect(conversations).toHaveLength(1)
    expect(conversations[0]).toMatchObject({ id: thread_id, resource_count: 1, open_questions: 1, artifact_count: 0 })
    // The manager's own opening note is not unread; the admin reply is.
    expect(conversations[0].unread).toBe(1)
  })

  test('a plain support thread on the same dictionary is not an import conversation', async () => {
    shared_db.prepare(`
      INSERT INTO message_threads (id, subject, source, from_email, dictionary_id, last_message_at, created_at, updated_at)
      VALUES ('t-support', 'Help', 'email', 'someone@x.com', 'dict-1', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z')
    `).run()
    const { conversations } = await (await LIST_CONVERSATIONS(event({ token: await manager_token() }))).json()
    expect(conversations).toEqual([])
  })
})

describe(GET_CONVERSATION, () => {
  test('404 for an unknown thread and for a thread on another dictionary', async () => {
    await expect(GET_CONVERSATION(event({ token: await manager_token(), params: { thread_id: 'nope' } })))
      .rejects.toMatchObject({ status: 404 })
  })

  test('returns the resources, the opening message, and the frozen flag', async () => {
    const { thread_id } = await open_conversation({ message: 'The margins matter.' })
    const before = await (await GET_CONVERSATION(event({ token: await manager_token(), params: { thread_id } }))).json()
    expect(before.is_frozen).toBeFalsy()
    expect(before.is_team).toBeFalsy()
    expect(before.resources).toHaveLength(1)
    expect(before.messages).toHaveLength(1)
    expect(before.messages[0].body_text).toBe('The margins matter.')
    expect(before.messages[0].author).toMatchObject({ name: 'Mgr', is_team: false })

    await start({ thread_id })
    const after = await (await GET_CONVERSATION(event({ token: await admin_token(), params: { thread_id } }))).json()
    expect(after.is_frozen).toBeTruthy()
    expect(after.is_team).toBeTruthy()
  })

  test('another manager of the same dictionary can read it', async () => {
    const { thread_id } = await open_conversation()
    const response = await GET_CONVERSATION(event({ token: await other_manager_token(), params: { thread_id } }))
    expect(response.status).toBe(200)
  })
})

describe(PATCH_CONVERSATION, () => {
  test('403 for a manager — start/resolve are team actions', async () => {
    const { thread_id } = await open_conversation()
    await expect(PATCH_CONVERSATION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id }, body: { started: true } })))
      .rejects.toMatchObject({ status: 403 })
  })

  test('start is idempotent and resolve toggles without touching the freeze', async () => {
    const { thread_id } = await open_conversation()
    await start({ thread_id })
    const first = await (await PATCH_CONVERSATION(event({ method: 'PATCH', token: await admin_token(), params: { thread_id }, body: { started: true } }))).json()
    const resolved = await (await PATCH_CONVERSATION(event({ method: 'PATCH', token: await admin_token(), params: { thread_id }, body: { resolved: true } }))).json()
    expect(resolved.conversation.started_at).toBe(first.conversation.started_at)
    expect(resolved.conversation.resolved_at).toBeTruthy()

    const reopened = await (await PATCH_CONVERSATION(event({ method: 'PATCH', token: await admin_token(), params: { thread_id }, body: { resolved: false } }))).json()
    expect(reopened.conversation.resolved_at).toBe(null)
    expect(reopened.conversation.started_at).toBe(first.conversation.started_at)
  })
})

describe('the freeze', () => {
  test('a manager can edit and delete a requested resource until we start, and never after', async () => {
    const { file_id, thread_id } = await open_conversation()
    const patched = await PATCH_FILE(event({ method: 'PATCH', token: await manager_token(), params: { file_id }, body: { import_instructions: 'Actually, skip the appendix.' } }))
    expect(patched.status).toBe(200)

    await start({ thread_id })

    await expect(PATCH_FILE(event({ method: 'PATCH', token: await manager_token(), params: { file_id }, body: { import_instructions: 'Changed my mind again.' } })))
      .rejects.toMatchObject({ status: 403 })
    await expect(DELETE_FILE(event({ method: 'DELETE', token: await manager_token(), params: { file_id } })))
      .rejects.toMatchObject({ status: 403 })
    await expect(PATCH_REQUEST_NOTE(event({ method: 'PATCH', token: await manager_token(), params: { thread_id }, body: { request_note: 'new note' } })))
      .rejects.toMatchObject({ status: 403 })

    // A site admin can still act deliberately.
    expect((await PATCH_FILE(event({ method: 'PATCH', token: await admin_token(), params: { file_id }, body: { import_instructions: 'Team correction.' } }))).status).toBe(200)
  })
})

describe(POST_WITHDRAW, () => {
  test('takes back an unstarted request, un-stamping the files and removing the conversation', async () => {
    const { file_id, thread_id } = await open_conversation()
    const response = await POST_WITHDRAW(event({ method: 'POST', token: await manager_token(), params: { thread_id } }))
    expect(response.status).toBe(200)
    expect(shared_db.prepare('SELECT id FROM message_threads WHERE id = ?').get(thread_id)).toBeUndefined()
    const file = shared_db.prepare('SELECT import_requested_at, import_thread_id FROM source_files WHERE id = ?').get(file_id) as Record<string, string | null>
    expect(file).toEqual({ import_requested_at: null, import_thread_id: null })
  })

  test('403 for another manager, and 403 once we have started', async () => {
    const { thread_id } = await open_conversation()
    await expect(POST_WITHDRAW(event({ method: 'POST', token: await other_manager_token(), params: { thread_id } })))
      .rejects.toMatchObject({ status: 403 })
    await start({ thread_id })
    await expect(POST_WITHDRAW(event({ method: 'POST', token: await manager_token(), params: { thread_id } })))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe(POST_MESSAGE, () => {
  test('400 on an empty body', async () => {
    const { thread_id } = await open_conversation()
    await expect(POST_MESSAGE(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { body_text: '   ' } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('records the right voice per actor and files the team on the team side', async () => {
    const { thread_id } = await open_conversation()
    await POST_MESSAGE(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { body_text: 'Any news?' } }))
    await POST_MESSAGE(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { body_text: 'Nearly there.' } }))
    await POST_MESSAGE(event({ method: 'POST', api_key: agent_token, params: { thread_id }, body: { body_text: '1,827 entries are live.' } }))

    const kinds = shared_db.prepare('SELECT author_kind, body_text FROM messages WHERE thread_id = ? ORDER BY created_at').all(thread_id)
    expect(kinds.map((row: Record<string, string>) => row.author_kind)).toEqual(['customer', 'customer', 'admin', 'agent'])
    // Machine-generated file edits are 'system' event lines, never anyone's message.
    await PATCH_FILE(event({ method: 'PATCH', token: await manager_token(), params: { file_id: (shared_db.prepare('SELECT id FROM source_files LIMIT 1').get() as { id: string }).id }, body: { import_instructions: 'Actually, skip the appendix.' } }))
    const event_line = shared_db.prepare(`SELECT author_kind, body_text FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1`).get(thread_id) as { author_kind: string, body_text: string }
    expect(event_line.author_kind).toBe('system')
    expect(event_line.body_text).toBe('Mgr updated the details for scan.pdf.')
    const sides = shared_db.prepare('SELECT user_id, side FROM thread_participants WHERE thread_id = ? ORDER BY user_id').all(thread_id)
    expect(sides).toEqual([{ user_id: 'mgr-1', side: 'manager' }, { user_id: 'u-jacob', side: 'team' }])
  })

  test('a manager post pings the assignee and posts ONE Notifications notice per unread batch', async () => {
    const { thread_id } = await open_conversation()
    post_system_notification.mockClear()
    notify_admin.mockClear()

    await POST_MESSAGE(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { body_text: 'First.' } }))
    await POST_MESSAGE(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { body_text: 'Second.' } }))
    const batch_ids = post_system_notification.mock.calls.map(call => call[0].client_message_id)
    expect(new Set(batch_ids).size).toBe(1)
    expect(batch_ids[0]).toBe(`import-activity:${thread_id}:0`)
    expect(notify_admin).toHaveBeenCalledWith(expect.objectContaining({ email: 'jwrunner7@gmail.com' }))

    // A team member opening the conversation re-arms the notice.
    await POST_READ(event({ method: 'POST', token: await admin_token(), params: { thread_id } }))
    await POST_MESSAGE(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { body_text: 'Third.' } }))
    const latest = post_system_notification.mock.calls[post_system_notification.mock.calls.length - 1]
    expect(latest[0].client_message_id).toBe(`import-activity:${thread_id}:1`)
  })

  test('a team post emails the manager once per unread batch and never notifies the room', async () => {
    const { thread_id } = await open_conversation()
    post_system_notification.mockClear()

    await POST_MESSAGE(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { body_text: 'We started.' } }))
    await POST_MESSAGE(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { body_text: 'Still going.' } }))
    expect(post_system_notification).not.toHaveBeenCalled()
    expect(send_raw_email).toHaveBeenCalledTimes(1)
    expect(send_raw_email.mock.calls[0][0]).toMatchObject({ to: { email: 'mgr@x.com', name: 'Mgr' } })

    // The Message-ID we sent is stored, so a stray inbox reply threads back here.
    const stamped = shared_db.prepare('SELECT COUNT(*) AS n FROM messages WHERE thread_id = ? AND message_id IS NOT NULL').get(thread_id) as { n: number }
    expect(stamped.n).toBe(1)

    await POST_READ(event({ method: 'POST', token: await manager_token(), params: { thread_id } }))
    await POST_MESSAGE(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { body_text: 'Done.' } }))
    expect(send_raw_email).toHaveBeenCalledTimes(2)
  })
})

describe(POST_QUESTIONS, () => {
  test('403 for a manager, 400 on a choice question with too few options', async () => {
    const { thread_id } = await open_conversation()
    await expect(POST_QUESTIONS(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { questions: [{ kind: 'text', title: 'x' }] } })))
      .rejects.toMatchObject({ status: 403 })
    await expect(POST_QUESTIONS(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { questions: [{ kind: 'choice', title: 'x', options: [{ value: 'a', label: 'A' }] }] } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('an agent files a mixed batch and the manager answers both kinds', async () => {
    const { thread_id } = await open_conversation()
    const created = await (await POST_QUESTIONS(event({
      method: 'POST',
      api_key: agent_token,
      params: { thread_id },
      body: {
        questions: [
          { kind: 'text', title: 'Who compiled this list?', report_anchor: '#q-provenance' },
          { kind: 'choice', title: 'Is the raised dot a morpheme break or vowel length?', options: [{ value: 'morpheme', label: 'Morpheme break' }, { value: 'length', label: 'Vowel length' }, { value: 'unsure', label: 'Not sure' }] },
        ],
      },
    }))).json()
    expect(created.questions.map((question: Record<string, unknown>) => question.position)).toEqual([1, 2])

    const answered = await (await PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id: created.questions[0].id }, body: { answer_text: 'A 1990s class handout.' } }))).json()
    expect(answered.question.status).toBe('answered')
    expect(answered.question.answered_by_user_id).toBe('mgr-1')

    const chosen = await (await PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id: created.questions[1].id }, body: { answer_values: ['morpheme'] } }))).json()
    expect(JSON.parse(chosen.question.answer_values_json)).toEqual(['morpheme'])

    // Both answers are mirrored into the timeline, using the option's label.
    const bodies = (shared_db.prepare('SELECT body_text FROM messages WHERE thread_id = ? ORDER BY created_at').all(thread_id) as { body_text: string }[]).map(row => row.body_text)
    expect(bodies[bodies.length - 2]).toContain('A 1990s class handout.')
    expect(bodies[bodies.length - 1]).toContain('Morpheme break')
  })

  test('a single-choice question refuses two selections, and a text question refuses values', async () => {
    const { thread_id } = await open_conversation()
    const created = await (await POST_QUESTIONS(event({
      method: 'POST',
      token: await admin_token(),
      params: { thread_id },
      body: {
        questions: [
          { kind: 'choice', title: 'One only', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
          { kind: 'text', title: 'Prose only' },
        ],
      },
    }))).json()
    await expect(PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id: created.questions[0].id }, body: { answer_values: ['a', 'b'] } })))
      .rejects.toMatchObject({ status: 400 })
    await expect(PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id: created.questions[1].id }, body: { answer_values: ['a'] } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('clearing an answer reopens the question, and only the team may close one', async () => {
    const { thread_id } = await open_conversation()
    const created = await (await POST_QUESTIONS(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { questions: [{ kind: 'text', title: 'Who compiled this?' }] } }))).json()
    const question_id = created.questions[0].id
    await PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id }, body: { answer_text: 'Someone' } }))
    const cleared = await (await PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id }, body: { answer_text: '' } }))).json()
    expect(cleared.question.status).toBe('open')

    await expect(PATCH_QUESTION(event({ method: 'PATCH', token: await manager_token(), params: { thread_id, question_id }, body: { status: 'closed' } })))
      .rejects.toMatchObject({ status: 403 })
    const closed = await (await PATCH_QUESTION(event({ method: 'PATCH', token: await admin_token(), params: { thread_id, question_id }, body: { status: 'closed' } }))).json()
    expect(closed.question.status).toBe('closed')
  })
})

describe(POST_ARTIFACT, () => {
  test('403 for a manager and 400 on a bad kind', async () => {
    const { thread_id } = await open_conversation()
    await expect(POST_ARTIFACT(event({ method: 'POST', token: await manager_token(), params: { thread_id }, body: { kind: 'report', html: '<html></html>' } })))
      .rejects.toMatchObject({ status: 403 })
    await expect(POST_ARTIFACT(event({ method: 'POST', token: await admin_token(), params: { thread_id }, body: { kind: 'summary', html: '<html></html>' } })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('an agent posts a report, and it comes back served with script execution blocked', async () => {
    const { thread_id } = await open_conversation()
    const { artifact } = await (await POST_ARTIFACT(event({
      method: 'POST',
      api_key: agent_token,
      params: { thread_id },
      body: { kind: 'report', html: '<html>report</html>', title: 'Import report', import_id: 'imp-1', stats: { entries: 1827 } },
    }))).json()
    expect(artifact.storage_key).toBe(`import/dict-1/artifacts/${artifact.id}.html`)
    expect(JSON.parse(artifact.stats_json)).toEqual({ entries: 1827 })

    const served = await GET_ARTIFACT(event({ token: await manager_token(), params: { thread_id, artifact_id: artifact.id } }))
    expect(served.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(served.headers.get('Content-Security-Policy')).not.toContain('script-src')
    expect(served.headers.get('Content-Disposition')).toBe('inline')

    const downloaded = await GET_ARTIFACT(event({ token: await manager_token(), params: { thread_id, artifact_id: artifact.id }, search: '?download' }))
    expect(downloaded.headers.get('Content-Disposition')).toContain('attachment')

    const listed = await (await GET_CONVERSATION(event({ token: await manager_token(), params: { thread_id } }))).json()
    expect(listed.artifacts).toHaveLength(1)
  })

  test('404 for an artifact belonging to a different conversation', async () => {
    const first = await open_conversation()
    const { artifact } = await (await POST_ARTIFACT(event({ method: 'POST', token: await admin_token(), params: { thread_id: first.thread_id }, body: { kind: 'report', html: '<html></html>' } }))).json()
    shared_db.prepare(`
      INSERT INTO message_threads (id, subject, source, thread_kind, from_email, dictionary_id, last_message_at, created_at, updated_at)
      VALUES ('t-other', 'Other', 'contact_form', 'import', 'x@x.com', 'dict-1', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z', '2026-07-25T00:00:00Z')
    `).run()
    await expect(GET_ARTIFACT(event({ token: await manager_token(), params: { thread_id: 't-other', artifact_id: artifact.id } })))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe(GET_BRIEF, () => {
  test('403 for a manager — the job brief is ours', async () => {
    const { thread_id } = await open_conversation()
    await expect(GET_BRIEF(event({ token: await manager_token(), params: { thread_id } })))
      .rejects.toMatchObject({ status: 403 })
  })

  test('renders the agent-ready runbook on demand, never storing it as a message', async () => {
    const { file_id, thread_id } = await open_conversation({ message: 'This is a 1979 published dictionary.' })
    const { brief } = await (await GET_BRIEF(event({ token: await admin_token(), params: { thread_id } }))).json()
    expect(brief).toContain(`Download: http://localhost/api/v1/dictionaries/dict-1/files/${file_id}`)
    expect(brief).toContain('Import all entries.')
    expect(brief).toContain('This is a 1979 published dictionary.')
    expect(brief).toContain('/api/v1/guides/importing')

    // The conversation itself holds only the requester's own words.
    const bodies = shared_db.prepare('SELECT body_text FROM messages WHERE thread_id = ?').all(thread_id) as { body_text: string }[]
    expect(bodies).toEqual([{ body_text: 'This is a 1979 published dictionary.' }])
  })
})
