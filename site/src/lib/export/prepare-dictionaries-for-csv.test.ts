import type { DictionaryView } from '$lib/types'
import { prepare_dictionary_for_csv } from './prepare-dictionaries-for-csv'

const timestamp = new Date('2021-08-02T14:00:00.000Z').toISOString()

describe(prepare_dictionary_for_csv, () => {
  const dictionaries: Partial<DictionaryView>[] = [
    {
      glottocode: 'badh1238',
      gloss_languages: ['en', 'hi', 'pa'],
      created_at: timestamp,
      created_by: 'OeVwHacvXMTW0ocKuidCWxBrCIP2',
      updated_by: 'OeVwHacvXMTW0ocKuidCWxBrCIP2',
      name: '<xaxdeleted>',
      entry_count: 0,
      public: 0,
      alternate_names: [],
      coordinates: {
        points: [{
          coordinates: {
            latitude: 30.133,
            longitude: 79.539,
          },
        }],
      },
      iso_639_3: '',
      id: 'badhani',
    },
    {
      created_by: 'qoP1VCYTaEWb9i3CEH16TcpoUNI3',
      updated_by: 'T4qikh1eTafizvpmHNcG29uRQ2j1',
      coordinates: {
        points: [{
          coordinates: {
            latitude: 51.833,
            longitude: 107.616,
          },
        }],
      },
      gloss_languages: ['en', 'ru', 'mn', 'cmn'],
      public: 0,
      entry_count: 1,
      iso_639_3: 'bua',
      glottocode: 'buri1258',
      alternate_names: ['Buriat', 'Buriad', 'Bargu'],
      name: 'Buryat',
      id: 'buryat',
    },
    {
      alternate_names: null,
      updated_by: 'FtP0LHfC9SMzyfcWN48HaNclSxC3',
      gloss_languages: ['ig'],
      name: ' IGBO LANGUAGE (ASUSU IGBO)',
      public: 0,
      location: 'South Eastern States of Nigeria, West Africa',
      created_by: 'vLfYz1Fja8SlL5dSIV7spGeFCXj1',
      entry_count: 1,
      id: 'igbo-language-(asusu-igb',
    },
  ]

  dictionaries.forEach((dictionary, index) => {
    test(`dictionary example ${index + 1}`, () => {
      expect(prepare_dictionary_for_csv(dictionary as DictionaryView)).toMatchSnapshot()
    })
  })
})
