import type { DictionaryView, Tables } from '@living-dictionaries/types'
import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'

export type DictionaryWithHelpers = DictionaryView & {
  editors: UserWithDictionaryRoles[]
  invites: Tables<'invites'>[]
}
