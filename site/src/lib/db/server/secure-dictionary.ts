import type { DictRole } from './get-dictionary-role'

/**
 * Secure dictionary mode (`dictionaries.bucket = 'secure'`) — the dictionary is
 * invisible and inaccessible except to users holding a DIRECT `dictionary_roles`
 * grant on it, or site admins of level 3 (Super Admin). Levels 1 (Super
 * Manager) and 2 (Admin) are deliberately blocked — the usual `admin_level >= 1`
 * bypass does NOT apply to secure dictionaries.
 *
 * Blocked callers must not be able to distinguish a secure dictionary from a
 * nonexistent one: pages redirect to `/` exactly like an unknown slug, and API
 * endpoints answer 404 `dictionary not found`.
 */

export const SECURE_DICT_ADMIN_LEVEL = 3

export function is_secure_dictionary(dictionary: { bucket?: string | null }): boolean {
  return dictionary.bucket === 'secure'
}

export function can_access_secure_dictionary({ role, admin_level }: {
  role: DictRole | 'admin' | null | undefined
  admin_level: number
}): boolean {
  return admin_level >= SECURE_DICT_ADMIN_LEVEL || !!role
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe(is_secure_dictionary, () => {
    it('only the secure bucket is secure', () => {
      expect(is_secure_dictionary({ bucket: 'secure' })).toBe(true)
      for (const bucket of ['public', 'unlisted', 'conlang', 'glossary', 'delete', null, undefined])
        expect(is_secure_dictionary({ bucket })).toBe(false)
    })
  })

  describe(can_access_secure_dictionary, () => {
    it('any direct role grants access', () => {
      expect(can_access_secure_dictionary({ role: 'contributor', admin_level: 0 })).toBe(true)
      expect(can_access_secure_dictionary({ role: 'editor', admin_level: 0 })).toBe(true)
      expect(can_access_secure_dictionary({ role: 'manager', admin_level: 0 })).toBe(true)
    })

    it('site admins need level 3 — levels 1 and 2 are blocked', () => {
      expect(can_access_secure_dictionary({ role: null, admin_level: 0 })).toBe(false)
      expect(can_access_secure_dictionary({ role: null, admin_level: 1 })).toBe(false)
      expect(can_access_secure_dictionary({ role: null, admin_level: 2 })).toBe(false)
      expect(can_access_secure_dictionary({ role: null, admin_level: 3 })).toBe(true)
    })
  })
}
