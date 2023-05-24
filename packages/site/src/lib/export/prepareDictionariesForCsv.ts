import type { IDictionary } from '@living-dictionaries/types';

enum StandardDictionaryCSVFields {
  name = 'Dictionary Name',
  url = 'URL',
  iso6393 = 'ISO 639-3',
  glottocode = 'Glottocode',
  location = 'Location',
  latitude = 'Latitude',
  longitude = 'Longitude',
  thumbnail = 'Thumbnail',
}
export type DictionaryForCSVKeys = keyof typeof StandardDictionaryCSVFields;
export type DictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string;
};

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

    return {
      name: dictionary.name.replace(/,/g, '_'),
      url: dictionary.url,
      iso6393: dictionary.iso6393 || '',
      glottocode: dictionary.glottocode || '',
      location: cleanedLocation,
      latitude: dictionary?.coordinates?.latitude ? dictionary.coordinates.latitude.toString() : '',
      longitude: dictionary?.coordinates?.longitude
        ? dictionary.coordinates.longitude.toString()
        : '',
      thumbnail: dictionary.thumbnail || '',
    };
  });
  return [headers, ...formattedDictionaries];
}
