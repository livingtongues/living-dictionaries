import type { Tables } from '$lib/types'

type Tag = Pick<Tables<'tags'>, 'id' | 'updated_at' | 'name' | 'private'>

export function should_include_tag(tag: Tag | undefined, admin_level: number): boolean {
  // A junction row can momentarily reference a tag missing from a torn bundle
  // read (sync commit racing the per-table reads) — treat it as not visible.
  if (!tag) return false
  return !(tag.name.startsWith('v4') && admin_level < 3) && !(tag.private && admin_level === 0)
}
