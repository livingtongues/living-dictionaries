import type { IDictionary } from '@living-dictionaries/types';
import { prepareDictionariesForCsv, type DictionaryForCSV } from './prepareDictionariesForCsv';

describe('prepareDictionariesForCsv', () => {
  const dictionaries: IDictionary[] = [
    {
      glottocode: 'badh1238',
      glossLanguages: ['en', 'hi', 'pa'],
      createdBy: 'OeVwHacvXMTW0ocKuidCWxBrCIP2',
      updatedBy: 'OeVwHacvXMTW0ocKuidCWxBrCIP2',
      name: '<xaxdeleted>',
      entryCount: 0,
      public: false,
      alternateNames: [],
      coordinates: {
        latitude: 30.133,
        longitude: 79.539,
      },
      iso6393: '',
      id: 'badhani',
    },
    {
      createdBy: 'qoP1VCYTaEWb9i3CEH16TcpoUNI3',
      updatedBy: 'T4qikh1eTafizvpmHNcG29uRQ2j1',
      coordinates: {
        latitude: 51.833,
        longitude: 107.616,
      },
      glossLanguages: ['en', 'ru', 'mn', 'cmn'],
      public: false,
      entryCount: 1,
      iso6393: 'bua',
      glottocode: 'buri1258',
      alternateNames: ['Buriat', 'Buriad', 'Bargu'],
      name: 'Buryat',
      id: 'buryat',
    },
    {
      alternateNames: null,
      updatedBy: 'FtP0LHfC9SMzyfcWN48HaNclSxC3',
      glossLanguages: ['ig'],
      name: ' IGBO LANGUAGE (ASUSU IGBO)',
      public: false,
      location: 'South Eastern States of Nigeria, West Africa',
      createdBy: 'vLfYz1Fja8SlL5dSIV7spGeFCXj1',
      entryCount: 1,
      id: 'igbo-language-(asusu-igb',
    },
  ];
  test('smoke test', () => {
    expect(prepareDictionariesForCsv(dictionaries)).toMatchInlineSnapshot(`
      [
        {
          "glottocode": "Glottocode",
          "iso6393": "ISO 639-3",
          "latitude": "Latitude",
          "location": "Location",
          "longitude": "Longitude",
          "name": "Dictionary Name",
          "thumbnail": "Thumbnail",
          "url": "URL",
        },
        {
          "glottocode": "badh1238",
          "iso6393": "",
          "latitude": "30.133",
          "location": "",
          "longitude": "79.539",
          "name": "<xaxdeleted>",
          "thumbnail": "",
          "url": undefined,
        },
        {
          "glottocode": "buri1258",
          "iso6393": "bua",
          "latitude": "51.833",
          "location": "",
          "longitude": "107.616",
          "name": "Buryat",
          "thumbnail": "",
          "url": undefined,
        },
        {
          "glottocode": "",
          "iso6393": "",
          "latitude": "",
          "location": "South Eastern States of Nigeria_ West Africa",
          "longitude": "",
          "name": " IGBO LANGUAGE (ASUSU IGBO)",
          "thumbnail": "",
          "url": undefined,
        },
      ]
    `);
  });
});
