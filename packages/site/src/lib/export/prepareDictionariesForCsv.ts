import type { DictionaryView } from '@living-dictionaries/types'

enum StandardDictionaryCSVFields {
  name = 'Dictionary Name',
  public = 'Public',
  entry_count = 'Entry Count',
  url = 'URL',
  iso6393 = 'ISO 639-3',
  glottocode = 'Glottocode',
  location = 'Location',
  latitude = 'Latitude',
  longitude = 'Longitude',
  thumbnail = 'Thumbnail',
}
type DictionaryForCSVKeys = keyof typeof StandardDictionaryCSVFields
export type StandardDictionaryForCSV = {
  [key in DictionaryForCSVKeys]: string | number | boolean;
}

export const dictionary_headers: StandardDictionaryForCSV = { ...StandardDictionaryCSVFields }

export function prepareDictionaryForCsv(dictionary: DictionaryView): StandardDictionaryForCSV {
  let cleanedLocation = ''
  if (dictionary.location) {
    const location = `${dictionary.location}`
    cleanedLocation = location.replace(/,/g, '_')
  }

  return {
    name: dictionary.name.replace(/,/g, '_'),
    public: dictionary.public,
    entry_count: dictionary.metadata?.url?.startsWith('http://talkingdictionary') ? '' : dictionary.entry_count,
    url: dictionary.metadata?.url || create_dictionary_url(dictionary.id),
    iso6393: dictionary.iso_639_3,
    glottocode: dictionary.glottocode,
    location: cleanedLocation,
    latitude: dictionary.coordinates?.points?.[0]?.coordinates.latitude,
    longitude: dictionary.coordinates?.points?.[0]?.coordinates.longitude,
    thumbnail: dictionary.metadata?.thumbnail,
  }
}

function create_dictionary_url(dictionary_id: string) {
  return `https://livingdictionaries.app/${dictionary_id}`
}
