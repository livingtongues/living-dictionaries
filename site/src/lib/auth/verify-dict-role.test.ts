import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { sign_jwt } from './jwt'
import { verify_auth_dict_role } from './verify-dict-role'

let shared: ReturnType<typeof open_test_shared_db>
const admin_levels = new Map<string, number>()

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => shared }
})

vi.mock('$lib/server/effective-admin-level', () => ({
  get_effective_admin_level: ({ email }: { email: string }) => admin_levels.get(email) ?? 0,
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

async function event_for(user: { id: string, email: string } | null) {
  const headers: Record<string, string> = {}
  if (user)
    headers.Authorization = `Bearer ${await sign_jwt({ sub: user.id, email: user.email, name: user.id })}`
  return { request: new Request('http://localhost', { headers }) }
}

const normal_dict = { id: 'normal', bucket: null }
const secure_dict = { id: 'hidden', bucket: 'secure' }

beforeEach(() => {
  admin_levels.clear()
  shared = open_test_shared_db()
  const add_dict = shared.prepare(`INSERT INTO dictionaries (id, name, bucket) VALUES (?, ?, ?)`)
  add_dict.run('normal', 'Normal', null)
  add_dict.run('hidden', 'Hidden', 'secure')
  const add_user = shared.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`)
  const add_role = shared.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at) VALUES (?, ?, ?, ?, '2026-01-01')`)
  for (const [user_id, dict_id, role] of [
    ['normal-contributor', 'normal', 'contributor'],
    ['hidden-contributor', 'hidden', 'contributor'],
    ['hidden-manager', 'hidden', 'manager'],
  ] as const) {
    add_user.run(user_id, `${user_id}@test.com`)
    add_role.run(`${user_id}-role`, dict_id, user_id, role)
  }
  for (const user_id of ['no-role', 'level1', 'level2', 'level3'])
    add_user.run(user_id, `${user_id}@test.com`)
  admin_levels.set('level1@test.com', 1)
  admin_levels.set('level2@test.com', 2)
  admin_levels.set('level3@test.com', 3)
})

function user(id: string) {
  return { id, email: `${id}@test.com` }
}

async function status_of(promise: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await promise
    return 'ok'
  } catch (err) {
    return (err as { status: number }).status
  }
}

describe(verify_auth_dict_role, () => {
  describe('normal dictionary (unchanged behavior)', () => {
    test('anonymous → 401', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(null), { dictionary: normal_dict }))).toBe(401)
    })

    test('session without a grant → 403 role_revoked', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(user('no-role')), { dictionary: normal_dict }))).toBe(403)
    })

    test('contributor passes a contributor gate but not a manager gate', async () => {
      const result = await verify_auth_dict_role(await event_for(user('normal-contributor')), { dictionary: normal_dict, min_role: 'contributor' })
      expect(result.role).toBe('contributor')
      expect(await status_of(verify_auth_dict_role(await event_for(user('normal-contributor')), { dictionary: normal_dict, min_role: 'manager' }))).toBe(403)
    })

    test('admin level 1 bypasses the role check', async () => {
      const result = await verify_auth_dict_role(await event_for(user('level1')), { dictionary: normal_dict, min_role: 'manager' })
      expect(result.role).toBe('admin')
    })
  })

  describe('secure dictionary', () => {
    test('anonymous → 404 (indistinguishable from a nonexistent dict)', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(null), { dictionary: secure_dict }))).toBe(404)
    })

    test('session without a grant → 404', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(user('no-role')), { dictionary: secure_dict }))).toBe(404)
    })

    test('admin levels 1 and 2 are blocked → 404; level 3 bypasses', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(user('level1')), { dictionary: secure_dict, min_role: 'contributor' }))).toBe(404)
      expect(await status_of(verify_auth_dict_role(await event_for(user('level2')), { dictionary: secure_dict, min_role: 'contributor' }))).toBe(404)
      const result = await verify_auth_dict_role(await event_for(user('level3')), { dictionary: secure_dict, min_role: 'manager' })
      expect(result.role).toBe('admin')
    })

    test('direct grants pass', async () => {
      const contributor = await verify_auth_dict_role(await event_for(user('hidden-contributor')), { dictionary: secure_dict, min_role: 'contributor' })
      expect(contributor.role).toBe('contributor')
      const manager = await verify_auth_dict_role(await event_for(user('hidden-manager')), { dictionary: secure_dict, min_role: 'manager' })
      expect(manager.role).toBe('manager')
    })

    test('a member with insufficient rank keeps the normal 403 (existence already known)', async () => {
      expect(await status_of(verify_auth_dict_role(await event_for(user('hidden-contributor')), { dictionary: secure_dict, min_role: 'manager' }))).toBe(403)
    })
  })
})
