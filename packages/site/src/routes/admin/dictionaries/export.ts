import { get } from 'svelte/store';
import type { DictionaryWithHelperStores, DictionaryWithHelpers } from './dictionaryWithHelpers';
import { downloadObjectsAsCSV } from '$lib/export/csv';
import { dictionary_headers as standard_headers, prepareDictionaryForCsv, timestamp_to_string_date, type StandardDictionaryForCSV } from '$lib/export/prepareDictionariesForCsv';

enum AdminDictionaryCSVFields {
  entryCount = 'Entries',
  gloss_languages = 'Gloss Languages',
  alternate_names = 'Alternate Names',
  alternate_orthographies = 'Alternate Orthographies',
  created_at = 'Created At',
  videoAccess = 'Video Access',
  languageUsedByCommunity = 'Language Used By Community',
  communityPermission = 'Community Permission',
  authorConnection = 'Author Connection',
  conLangDescription = 'Conlang Description',
  managers = 'Managers',
  contributors = 'Contributors',
  writeInCollaborators = 'Write-In Collaborators',
  invites = 'Pending Invites',
}

type DictionaryForCSVKeys = keyof typeof AdminDictionaryCSVFields;
type AdminDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string | boolean | number;
};

const admin_headers: AdminDictionaryForCSV = { ...AdminDictionaryCSVFields };

export function exportAdminDictionariesAsCSV(dictionariesAndHelpers: DictionaryWithHelperStores[]) {
  const dictionaries = getAllDictionariesAndHelpers(dictionariesAndHelpers);

  const formatted_dictionaries: (StandardDictionaryForCSV & AdminDictionaryForCSV)[] = dictionaries.map((dictionary) => {
    const standard_dictionary = prepareDictionaryForCsv(dictionary);
    const admin_dictionary: AdminDictionaryForCSV = {
      entryCount: dictionary.entryCount,
      videoAccess: dictionary.videoAccess,
      languageUsedByCommunity: dictionary.languageUsedByCommunity,
      communityPermission: dictionary.communityPermission as string,
      authorConnection: dictionary.authorConnection,
      conLangDescription: dictionary.conLangDescription,

      // special adjustments needed
      gloss_languages: dictionary.glossLanguages?.join(', '),
      alternate_names: dictionary.alternateNames?.join(', '),
      alternate_orthographies: dictionary.alternateOrthographies?.join(', '),
      created_at: timestamp_to_string_date(dictionary.createdAt),

      // data from subcollections
      managers: dictionary.managers.map(({ name }) => name).join(', '),
      contributors: dictionary.contributors.map(({ name }) => name).join(', '),
      writeInCollaborators: dictionary.writeInCollaborators.map(({ name }) => name).join(', '),
      invites: dictionary.invites.map((invite) => {
        return `${invite.inviterName} (${invite.inviterEmail}) invited ${invite.targetEmail} as ${invite.role} on ${timestamp_to_string_date(invite.createdAt)}`;
      }).join(', '),
    }

    return { ...standard_dictionary, ...admin_dictionary };
  });

  downloadObjectsAsCSV(
    { ...standard_headers, ...admin_headers },
    formatted_dictionaries,
    'living-dictionaries-public-private'
  )
}

function getAllDictionariesAndHelpers(
  dictionariesAndHelpers: DictionaryWithHelperStores[]
): DictionaryWithHelpers[] {
  return dictionariesAndHelpers.map((dictionary) => {
    return {
      ...dictionary,
      managers: get(dictionary.managers),
      contributors: get(dictionary.contributors),
      writeInCollaborators: get(dictionary.writeInCollaborators),
      invites: get(dictionary.invites),
    };
  });
}