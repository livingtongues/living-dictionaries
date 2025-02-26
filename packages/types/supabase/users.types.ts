import type { Database, Tables } from './combined.types'

export type DictionaryRolesWithoutUser = Omit<Tables<'dictionary_roles'>, 'user_id'>

export type UserForAdminTable = Database['public']['Functions']['users_for_admin_table']['Returns'][0]

export type UserWithDictionaryRoles = UserForAdminTable & { dictionary_roles: Tables<'dictionary_roles'>[] }
