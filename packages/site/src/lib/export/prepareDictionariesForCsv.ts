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
type DictionaryForCSVKeys = keyof typeof StandardDictionaryCSVFields;
export type StandardDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string | number | boolean;
};

export const dictionary_headers: StandardDictionaryForCSV = { ...StandardDictionaryCSVFields };

export function prepareDictionaryForCsv(dictionary: IDictionary): StandardDictionaryForCSV {
  let cleanedLocation = '';
  if (dictionary.location) {
    const location = dictionary.location + '';
    cleanedLocation = location.replace(/,/g, '_');
  }

  return {
    name: dictionary.name.replace(/,/g, '_'),
    public: dictionary.public,
    url: dictionary.url || create_dictionary_url(dictionary.id),
    iso6393: dictionary.iso6393,
    glottocode: dictionary.glottocode,
    location: cleanedLocation,
    latitude: dictionary.coordinates?.latitude,
    longitude: dictionary.coordinates?.longitude,
    thumbnail: dictionary.thumbnail,
  };
}

export function timestamp_to_string_date(timestamp: Timestamp): string {
  if (timestamp) {
    const milliseconds = timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000);
    const date = new Date(milliseconds);
    return date.toDateString();
  }
}

function create_dictionary_url(dictionary_id: string) {
  return `https://livingdictionaries.app/${dictionary_id}`;
}
