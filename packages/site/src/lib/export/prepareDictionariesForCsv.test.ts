import type { IDictionary } from '@living-dictionaries/types';
import { prepareDictionaryForCsv, timestamp_to_string_date } from './prepareDictionariesForCsv';
import type { Timestamp } from 'firebase/firestore';

const timestamp = {
  seconds: 1591088635,
  nanoseconds: 880000000,
} as Timestamp;

describe('timestamp_to_string_date', () => {
  test('converts createdAt to readable string', () => {
    expect(timestamp_to_string_date(timestamp)).toEqual('Tue Jun 02 2020');
  });

  test('returns an empty string if timestamp is falsy', () => {
    expect(timestamp_to_string_date(undefined)).toEqual(undefined);
  });
});

describe('prepareDictionaryForCsv', () => {
  const dictionaries: IDictionary[] = [
    {
      glottocode: 'badh1238',
      glossLanguages: ['en', 'hi', 'pa'],
      createdAt: timestamp,
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

  dictionaries.forEach((dictionary, index) => {
    test(`dictionary example ${index + 1}`, () => {
      expect(prepareDictionaryForCsv(dictionary)).toMatchSnapshot();
    });
  });
});
