import type { Database, Tables } from './combined.types'

export type DictionaryRolesWithoutUser = Omit<Tables<'dictionary_roles'>, 'user_id'>
export type UserWithDictionaryRoles = Database['public']['Functions']['users_with_dictionary_roles']['Returns'][0]
