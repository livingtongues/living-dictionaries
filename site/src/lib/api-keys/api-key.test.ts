import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { create_api_key, delete_api_key, generate_api_key, hash_api_key, list_api_keys, resolve_api_keys, revoke_api_key, verify_api_key } from './api-key'

let db: ReturnType<typeof open_test_shared_db>

function seed_dictionary(id: string) {
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('user-1', 'a@b.com', 'A', JSON.stringify([{ provider: 'email', provider_id: 'a@b.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)`)
    .run(id, 'Test Dict', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
}

beforeEach(() => {
  db = open_test_shared_db()
  seed_dictionary('dict-1')
})

afterEach(() => {
  db.close()
})

describe(generate_api_key, () => {
  test('mints an ldk_-prefixed token whose hash matches', () => {
    const minted = generate_api_key()
    expect(minted.token.startsWith('ldk_')).toBeTruthy()
    expect(minted.token_prefix).toBe(minted.token.slice(0, 10))
    expect(minted.last_four).toBe(minted.token.slice(-4))
    expect(minted.token_hash).toBe(hash_api_key(minted.token))
  })

  test('two tokens differ', () => {
    expect(generate_api_key().token).not.toBe(generate_api_key().token)
  })
})

describe(create_api_key, () => {
  test('persists a key and returns the one-time token; hash is not exposed in listing', () => {
    const { record, token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'My agent', created_by_user_id: 'user-1' })
    expect(token.startsWith('ldk_')).toBeTruthy()
    expect(record.role).toBe('write')

    const listed = list_api_keys({ db, dictionary_id: 'dict-1' })
    expect(listed).toHaveLength(1)
    expect(listed[0].label).toBe('My agent')
    expect(listed[0]).not.toHaveProperty('token_hash')
    expect(listed[0].last_four).toBe(token.slice(-4))
  })
})

describe(verify_api_key, () => {
  test('resolves a valid token to its dictionary + role + creator', () => {
    const { token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', role: 'read', created_by_user_id: 'user-1' })
    const verified = verify_api_key({ db, token })
    expect(verified).toMatchObject({ dictionary_id: 'dict-1', role: 'read', created_by_user_id: 'user-1' })
  })

  test('rejects an unknown token', () => {
    expect(verify_api_key({ db, token: 'ldk_nope' })).toBeNull()
  })

  test('rejects a non-ldk token without a DB hit', () => {
    expect(verify_api_key({ db, token: 'eyJhbGciOi.jwt.looking' })).toBeNull()
  })

  test('rejects a revoked token', () => {
    const { record, token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    db.prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ?`).run('2026-02-01T00:00:00Z', record.id)
    expect(verify_api_key({ db, token })).toBeNull()
  })

  test('stamps last_used_at on first use', () => {
    const { record, token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    verify_api_key({ db, token })
    const row = db.prepare(`SELECT last_used_at FROM api_keys WHERE id = ?`).get(record.id) as { last_used_at: string | null }
    expect(row.last_used_at).toBeTruthy()
  })
})

describe(delete_api_key, () => {
  test('removes a key scoped to its dictionary', () => {
    const { record, token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    expect(delete_api_key({ db, dictionary_id: 'dict-1', key_id: record.id })).toBeTruthy()
    expect(verify_api_key({ db, token })).toBeNull()
    expect(list_api_keys({ db, dictionary_id: 'dict-1' })).toHaveLength(0)
  })

  test('does not delete across dictionaries', () => {
    const { record } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    expect(delete_api_key({ db, dictionary_id: 'other-dict', key_id: record.id })).toBeFalsy()
    expect(list_api_keys({ db, dictionary_id: 'dict-1' })).toHaveLength(1)
  })
})

describe(revoke_api_key, () => {
  test('revokes a key: token stops working + drops out of the active list, but the row is retained', () => {
    const { record, token } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    expect(revoke_api_key({ db, dictionary_id: 'dict-1', key_id: record.id })).toBeTruthy()
    expect(verify_api_key({ db, token })).toBeNull()
    expect(list_api_keys({ db, dictionary_id: 'dict-1' })).toHaveLength(0)
    // Row retained so history can still resolve the agent.
    const row = db.prepare(`SELECT id, revoked_at FROM api_keys WHERE id = ?`).get(record.id) as { id: string, revoked_at: string | null }
    expect(row.id).toBe(record.id)
    expect(row.revoked_at).toBeTruthy()
  })

  test('a second revoke is a no-op (returns false)', () => {
    const { record } = create_api_key({ db, dictionary_id: 'dict-1', label: 'k', created_by_user_id: 'user-1' })
    expect(revoke_api_key({ db, dictionary_id: 'dict-1', key_id: record.id })).toBeTruthy()
    expect(revoke_api_key({ db, dictionary_id: 'dict-1', key_id: record.id })).toBeFalsy()
  })
})

describe(resolve_api_keys, () => {
  test('resolves ids to label + creator, including revoked keys', () => {
    const { record } = create_api_key({ db, dictionary_id: 'dict-1', label: 'Dictionary agent', created_by_user_id: 'user-1' })
    revoke_api_key({ db, dictionary_id: 'dict-1', key_id: record.id })
    const resolved = resolve_api_keys({ db, key_ids: [record.id, ''] })
    expect(resolved[record.id]).toEqual({ id: record.id, label: 'Dictionary agent', created_by_user_id: 'user-1' })
  })

  test('returns an empty map for no ids', () => {
    expect(resolve_api_keys({ db, key_ids: [] })).toEqual({})
  })
})
