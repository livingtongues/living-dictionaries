import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'
import { downloadObjectsAsCSV } from '$lib/export/csv'
import { type StandardDictionaryForCSV, prepareDictionaryForCsv, dictionary_headers as standard_headers } from '$lib/export/prepareDictionariesForCsv'
import { supabase_date_to_friendly } from '$lib/helpers/time'

enum AdminDictionaryCSVFields {
  entryCount = 'Entries',
  gloss_languages = 'Gloss Languages',
  alternate_names = 'Alternate Names',
  alternate_orthographies = 'Alternate Orthographies',
  created_at = 'Created At',
  languageUsedByCommunity = 'Language Used By Community',
  communityPermission = 'Community Permission',
  authorConnection = 'Author Connection',
  conLangDescription = 'Conlang Description',
  managers = 'Managers',
  contributors = 'Contributors',
  invites = 'Pending Invites',
}

type DictionaryForCSVKeys = keyof typeof AdminDictionaryCSVFields
type AdminDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string | boolean | number;
}

const admin_headers: AdminDictionaryForCSV = { ...AdminDictionaryCSVFields }

export function exportAdminDictionariesAsCSV(dictionaries: DictionaryWithHelpers[]) {
  const formatted_dictionaries: (StandardDictionaryForCSV & AdminDictionaryForCSV)[] = dictionaries.map((dictionary) => {
    const standard_dictionary = prepareDictionaryForCsv(dictionary)
    const admin_dictionary: AdminDictionaryForCSV = {
      entryCount: dictionary.entry_count,
      languageUsedByCommunity: dictionary.language_used_by_community,
      communityPermission: dictionary.community_permission,
      authorConnection: dictionary.author_connection,
      conLangDescription: dictionary.con_language_description,

      // special adjustments needed
      gloss_languages: dictionary.gloss_languages?.join(', '),
      alternate_names: dictionary.alternate_names?.join(', '),
      alternate_orthographies: dictionary.orthographies?.map(({ name }) => name.default)?.join(', '),
      created_at: dictionary.created_at,

      managers: dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'manager')).map(({ full_name, email }) => full_name || email).join(', '),
      contributors: dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'contributor')).map(({ full_name, email }) => full_name || email).join(', '),
      invites: dictionary.invites.map((invite) => {
        return `${invite.inviter_email} invited ${invite.target_email} as ${invite.role} on ${supabase_date_to_friendly(invite.created_at)}`
      }).join(', '),
    }

    return { ...standard_dictionary, ...admin_dictionary }
  })

  downloadObjectsAsCSV(
    { ...standard_headers, ...admin_headers },
    formatted_dictionaries,
    'living-dictionaries-public-private',
  )
}
