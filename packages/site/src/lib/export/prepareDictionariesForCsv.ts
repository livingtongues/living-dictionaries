import type { IDictionary } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';

enum StandardDictionaryCSVFields {
  name = 'Dictionary Name',
  public = 'Public',
  entries = 'No. Entries',
  url = 'URL',
  iso6393 = 'ISO 639-3',
  glottocode = 'Glottocode',
  location = 'Location',
  latitude = 'Latitude',
  longitude = 'Longitude',
  thumbnail = 'Thumbnail',
  gloss_languages = 'Gloss Languages',
  alternate_names = 'Alternate Names',
  alternate_orthographies = 'Alternate Orthographies',
  created_at = 'Created At',
  video_access = 'Video Access',
  language_used_by_community = 'Language Used By Community',
  community_permission = 'Community Permission',
  author_connection = 'Author Connection',
  conlang_description = 'Conlang Description',
}
export type DictionaryForCSVKeys = keyof typeof StandardDictionaryCSVFields;
export type DictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string;
};

export function timestamp_to_string_date(timestamp: Timestamp): string {
  if (timestamp) {
    const milliseconds = timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000);
    const date = new Date(milliseconds);
    return date.toDateString();
  }
  return '';
}

export function prepareDictionariesForCsv(dictionaries: IDictionary[]): DictionaryForCSV[] {
  const headers = {} as DictionaryForCSV;
  for (const key in StandardDictionaryCSVFields) {
    headers[key] = StandardDictionaryCSVFields[key];
  }

  const formattedDictionaries: DictionaryForCSV[] = dictionaries.map((dictionary) => {
    let cleanedLocation = '';
    if (dictionary.location) {
      const location = dictionary.location + '';
      cleanedLocation = location.replace(/,/g, '_');
    }
    // console.log('Dic Name', dictionary.name);
    return {
      name: dictionary.name.replace(/,/g, '_'),
      public: dictionary?.public?.toString(),
      entries: dictionary?.entryCount?.toString(),
      url: dictionary.url,
      iso6393: dictionary.iso6393,
      glottocode: dictionary.glottocode,
      location: cleanedLocation,
      latitude: dictionary?.coordinates?.latitude
        ? dictionary.coordinates.latitude?.toString()
        : '',
      longitude: dictionary?.coordinates?.longitude
        ? dictionary.coordinates.longitude?.toString()
        : '',
      thumbnail: dictionary.thumbnail,
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
  });
  return [headers, ...formattedDictionaries];
}
