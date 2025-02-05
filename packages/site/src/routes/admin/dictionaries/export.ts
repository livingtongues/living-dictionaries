import type { DictionaryWithHelperStores, DictionaryWithHelpers } from './dictionaryWithHelpers'
import { downloadObjectsAsCSV } from '$lib/export/csv'
import { type StandardDictionaryForCSV, prepareDictionaryForCsv, dictionary_headers as standard_headers, timestamp_to_string_date } from '$lib/export/prepareDictionariesForCsv'

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
  writeInCollaborators = 'Write-In Collaborators',
  invites = 'Pending Invites',
}

type DictionaryForCSVKeys = keyof typeof AdminDictionaryCSVFields
type AdminDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string | boolean | number;
}

const admin_headers: AdminDictionaryForCSV = { ...AdminDictionaryCSVFields }

export async function exportAdminDictionariesAsCSV(dictionariesAndHelpers: DictionaryWithHelperStores[], section: 'public' | 'private' | 'other') {
  const dictionaries = await getAllDictionariesAndHelpers(dictionariesAndHelpers)

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

      // data from subcollections
      managers: dictionary.managers.map(({ name }) => name).join(', '),
      contributors: dictionary.contributors.map(({ name }) => name).join(', '),
      writeInCollaborators: dictionary.writeInCollaborators.map(({ name }) => name).join(', '),
      invites: dictionary.invites.map((invite) => {
        return `${invite.inviterName} (${invite.inviterEmail}) invited ${invite.targetEmail} as ${invite.role} on ${timestamp_to_string_date(invite.createdAt)}`
      }).join(', '),
    }

    return { ...standard_dictionary, ...admin_dictionary }
  })

  downloadObjectsAsCSV(
    { ...standard_headers, ...admin_headers },
    formatted_dictionaries,
    `living-dictionaries-${section}`,
  )
}

async function getAllDictionariesAndHelpers(
  dictionariesAndHelpers: DictionaryWithHelperStores[],
): Promise<DictionaryWithHelpers[]> {
  const dictionaries: DictionaryWithHelpers[] = []
  for (const dictionary of dictionariesAndHelpers) {
    dictionaries.push({
      ...dictionary,
      managers: await dictionary.getManagers,
      contributors: await dictionary.getContributors,
      writeInCollaborators: await dictionary.getWriteInCollaborators,
      invites: await dictionary.getInvites,
    })
  }
  return dictionaries
}
