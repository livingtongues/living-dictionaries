import type { IDictionary } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';

enum StandardDictionaryCSVFields {
  name = 'Dictionary Name',
  public = 'Public',
  url = 'URL',
  iso6393 = 'ISO 639-3',
  glottocode = 'Glottocode',
  location = 'Location',
  latitude = 'Latitude',
  longitude = 'Longitude',
  thumbnail = 'Thumbnail',
}
export type DictionaryForCSVKeys = keyof typeof StandardDictionaryCSVFields;
type StandardDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string;
};

export interface DictionaryForCSV extends StandardDictionaryForCSV {
  entries?: string;
  gloss_languages?: string;
  alternate_names?: string;
  alternate_orthographies?: string;
  created_at?: string;
  video_access?: string;
  language_used_by_community?: string;
  community_permission?: string;
  author_connection?: string;
  conlang_description?: string;
}

export function timestamp_to_string_date(timestamp: Timestamp): string {
  if (timestamp) {
    const milliseconds = timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000);
    const date = new Date(milliseconds);
    return date.toDateString();
  }
  return '';
}

export function create_dictionary_url(dictionary_id: string) {
  return `https://livingdictionaries.app/${dictionary_id}`;
}

export function prepareDictionariesForCsv(
  dictionaries: IDictionary[],
  admin: number
): DictionaryForCSV[] {
  const default_headers: DictionaryForCSV = { ...StandardDictionaryCSVFields };
  let admin_headers = {};
  if (admin > 1) {
    admin_headers = {
      entries: 'No. Entries',
      gloss_languages: 'Gloss Languages',
      alternate_names: 'Alternate Names',
      alternate_orthographies: 'Alternate Orthographies',
      created_at: 'Created At',
      video_access: 'Video Access',
      language_used_by_community: 'Language Used By Community',
      community_permission: 'Community Permission',
      author_connection: 'Author Connection',
      conlang_description: 'Conlang Description',
    };
  }
  const headers = { ...default_headers, ...admin_headers };

  const formattedDictionaries: DictionaryForCSV[] = dictionaries.map((dictionary) => {
    let cleanedLocation = '';
    if (dictionary.location) {
      const location = dictionary.location + '';
      cleanedLocation = location.replace(/,/g, '_');
    }

    const formatted_dictionary = {
      name: dictionary.name.replace(/,/g, '_'),
      public: dictionary?.public?.toString(),
      url: dictionary.url || create_dictionary_url(dictionary.id),
      iso6393: dictionary.iso6393,
      glottocode: dictionary.glottocode,
      location: cleanedLocation,
      latitude: dictionary?.coordinates?.latitude?.toString(),
      longitude: dictionary?.coordinates?.longitude?.toString(),
      thumbnail: dictionary.thumbnail,
    };
    let formatted_admin_dictionary = {};
    if (admin > 1) {
      formatted_admin_dictionary = {
        entries: dictionary?.entryCount?.toString(),
        gloss_languages: dictionary?.glossLanguages?.join(', '),
        alternate_names: dictionary?.alternateNames?.join(', '),
        alternate_orthographies: dictionary?.alternateOrthographies?.join(', '),
        created_at: timestamp_to_string_date(dictionary?.createdAt),
        video_access: dictionary?.videoAccess?.toString(),
        language_used_by_community: dictionary?.languageUsedByCommunity?.toString(),
        community_permission: dictionary?.communityPermission,
        author_connection: dictionary?.authorConnection,
        conlang_description: dictionary.conLangDescription,
      };
    }
    return { ...formatted_dictionary, ...formatted_admin_dictionary };
  });
  return [headers, ...formattedDictionaries];
}
