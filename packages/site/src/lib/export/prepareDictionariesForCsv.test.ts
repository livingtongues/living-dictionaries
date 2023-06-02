import type { IDictionary } from '@living-dictionaries/types';
import {
  prepareDictionariesForCsv,
  timestamp_to_string_date,
  create_dictionary_url,
} from './prepareDictionariesForCsv';

describe('create_dictionary_url', () => {
  test('returns a dictionary URL', () => {
    const dictionary_id = 'foo';
    expect(create_dictionary_url(dictionary_id)).toEqual('https://livingdictionaries.app/foo');
  });
});

describe('timestamp_to_string_date', () => {
  test('converts createdAt to readable string', () => {
    const timpestamp = {
      seconds: 1591088635,
      nanoseconds: 880000000,
    };
    expect(timestamp_to_string_date(timpestamp)).toEqual('Tue Jun 02 2020');
  });
  test('returns an empty string if timestime is falsy', () => {
    const timestamp = undefined;
    expect(timestamp_to_string_date(timestamp)).toEqual('');
  });
});

describe('prepareDictionariesForCsv', () => {
  const dictionaries: IDictionary[] = [
    {
      glottocode: 'badh1238',
      glossLanguages: ['en', 'hi', 'pa'],
      createdAt: {
        seconds: 1669080253,
        nanoseconds: 340000000,
      },
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
  test('admin/dictionaries example', () => {
    const admin = 2;
    expect(prepareDictionariesForCsv(dictionaries, admin)).toMatchSnapshot();
  });
  test('List of dictionaries example', () => {
    const admin = 0;
    expect(prepareDictionariesForCsv(dictionaries, admin)).toMatchSnapshot();
  });
});
