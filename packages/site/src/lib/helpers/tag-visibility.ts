import type { Tables } from '@living-dictionaries/types/supabase/combined.types'

type Tag = Pick<Tables<'tags'>, 'id' | 'updated_at' | 'name' | 'private'>

export function should_include_tag(tag: Tag, admin_level: number): boolean {
  return !(tag.name.startsWith('v4') && admin_level !== 2) && !(tag.private && admin_level === 0)
}