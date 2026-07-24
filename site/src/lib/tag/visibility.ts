import type { Tables } from '$lib/types'

type Tag = Pick<Tables<'tags'>, 'id' | 'updated_at' | 'name' | 'private'>

/**
 * Whether a tag is visible to this viewer.
 *   - `v4…` legacy-import tags: Super Admins only (`admin_level >= 3`).
 *   - `private` tags: EDITORS of this dictionary (managers/contributors, i.e.
 *     `can_edit`) OR any site admin (`admin_level >= 1`). A plain manager has
 *     `admin_level 0`, so `can_edit` is what lets them see private tags on their
 *     own dict.
 */
export function should_include_tag(tag: Tag | undefined, { admin_level, can_edit = false }: { admin_level: number, can_edit?: boolean }): boolean {
  // A junction row can momentarily reference a tag missing from a torn bundle
  // read (sync commit racing the per-table reads) — treat it as not visible.
  if (!tag) return false
  const v4_hidden = tag.name.startsWith('v4') && admin_level < 3
  const private_hidden = !!tag.private && admin_level < 1 && !can_edit
  return !v4_hidden && !private_hidden
}

if (import.meta.vitest) {
  const pub = { id: 'a', name: 'animals', private: 0 } as Tag
  const priv = { id: 'b', name: 'sensitive', private: 1 } as Tag
  const v4 = { id: 'c', name: 'v4-legacy', private: 0 } as Tag

  describe(should_include_tag, () => {
    it('shows public tags to everyone', () => {
      expect(should_include_tag(pub, { admin_level: 0 })).toBe(true)
    })
    it('hides private tags from the anonymous public', () => {
      expect(should_include_tag(priv, { admin_level: 0 })).toBe(false)
    })
    it('shows private tags to a plain editor (can_edit) even at admin_level 0', () => {
      expect(should_include_tag(priv, { admin_level: 0, can_edit: true })).toBe(true)
    })
    it('shows private tags to any site admin', () => {
      expect(should_include_tag(priv, { admin_level: 1 })).toBe(true)
    })
    it('shows v4 tags only to super admins (level 3), not to editors', () => {
      expect(should_include_tag(v4, { admin_level: 2 })).toBe(false)
      expect(should_include_tag(v4, { admin_level: 0, can_edit: true })).toBe(false)
      expect(should_include_tag(v4, { admin_level: 3 })).toBe(true)
    })
    it('treats a missing tag as not visible', () => {
      expect(should_include_tag(undefined, { admin_level: 3, can_edit: true })).toBe(false)
    })
  })
}
