import { get } from 'svelte/store';
import type { DictionaryWithHelperStores, DictionaryWithHelpers } from './dictionaryWithHelpers';
import { downloadObjectsAsCSV } from '$lib/export/csv';
import { dictionary_headers, prepareDictionaryForCsv, timestamp_to_string_date } from '$lib/export/prepareDictionariesForCsv';

enum AdminDictionaryCSVFields {
  entries = 'No. Entries',
  gloss_languages = 'Gloss Languages',
  alternate_names = 'Alternate Names',
  alternate_orthographies = 'Alternate Orthographies',
  created_at = 'Created At',
  videoAccess = 'Video Access',
  languageUsedByCommunity = 'Language Used By Community',
  communityPermission = 'Community Permission',
  authorConnection = 'Author Connection',
  conLangDescription = 'Conlang Description',
}

type DictionaryForCSVKeys = keyof typeof AdminDictionaryCSVFields;
type AdminDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string;
};

const admin_headers: AdminDictionaryForCSV = { ...AdminDictionaryCSVFields };

export function exportAdminDictionariesAsCSV(dictionariesAndHelpers: DictionaryWithHelperStores[]) {
  const dictionaries = getAllDictionariesAndHelpers(dictionariesAndHelpers);

  const formatted_dictionaries = dictionaries.map((dictionary) => {
    return {
      ...prepareDictionaryForCsv(dictionary),
      
      // could just use ...dictionary before prepareDictionaryForCsv, but this is more explicit
      entryCount: dictionary.entryCount,
      videoAccess: dictionary.videoAccess,
      languageUsedByCommunity: dictionary.languageUsedByCommunity,
      communityPermission: dictionary.communityPermission,
      authorConnection: dictionary.authorConnection,
      conLangDescription: dictionary.conLangDescription,
      
      // special adjustments needed
      gloss_languages: dictionary.glossLanguages?.join(', '),
      alternate_names: dictionary.alternateNames?.join(', '),
      alternate_orthographies: dictionary.alternateOrthographies?.join(', '),
      created_at: timestamp_to_string_date(dictionary.createdAt),
    }
  });

  downloadObjectsAsCSV(
    { ...dictionary_headers, ...admin_headers },
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