import type { RowType } from '$lib/pglite/live/types'

export type UserWithRoles = RowType<'users'> & {
  dictionary_roles: RowType<'dictionary_roles'>[]
}

export type DictionaryWithHelpers = RowType<'dictionaries'> & {
  editors: UserWithRoles[]
  invites: RowType<'invites'>[]
}
