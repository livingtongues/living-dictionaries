import type {
  ActualDatabaseEntry,
  IDictionary,
  IEntry,
  IPartOfSpeech,
  ISemanticDomain,
  ISpeaker,
} from '@living-dictionaries/types';
import type { IEntryForCSV } from './formatEntries';
import { format_parts_of_speech, formatEntriesForCSV } from './formatEntries';

describe('format_parts_of_speech', () => {
  const global_pos: IPartOfSpeech[] = [
    { enAbbrev: 'n', enName: 'noun' },
    { enAbbrev: 'adj', enName: 'adjective' },
  ];
  const formattedEntry = {
    lx: 'pato',
  } as IEntryForCSV;
  test('parts of speech as string', () => {
    const parts_of_speech = 'n';
    format_parts_of_speech(global_pos, formattedEntry, parts_of_speech);
    expect(formattedEntry).toStrictEqual({
      lx: 'pato',
      ps: 'noun',
      psab: 'n',
    });
  });
  test.fails('parts of speech not included', () => {
    const parts_of_speech = 'old pos';
    format_parts_of_speech(global_pos, formattedEntry, parts_of_speech);
    expect(formattedEntry).toStrictEqual({
      lx: 'pato',
      ps: 'old pos',
    });
  });
  test('parts of speech as array', () => {
    const parts_of_speech = ['adj', 'n'];
    format_parts_of_speech(global_pos, formattedEntry, parts_of_speech);
    expect(formattedEntry).toStrictEqual({
      lx: 'pato',
      ps: 'adjective',
      psab: 'adj',
    });
  });
});

describe('formatEntriesForCSV', () => {
  const dictionary: IDictionary = {
    name: 'TestLang',
    id: 'test',
    glossLanguages: ['ar', 'en'],
    alternateOrthographies: ['native-1', 'native-2'],
    entryCount: 0,
  };
  const speakers: ISpeaker[] = [
    {
      displayName: 'John Smith',
      id: '123',
      birthplace: 'Whoville',
      decade: 4,
      gender: 'm',
    },
  ];
  const semanticDomains: ISemanticDomain[] = [{ key: '2.1', name: 'Plant Test Domain' }];
  const partsOfSpeech: IPartOfSpeech[] = [{ enAbbrev: 'n', enName: 'noun' }];
  const expected = [
    {
      di: 'Dialect',
      glar: 'Arabic Gloss',
      glen: 'English Gloss',
      id: 'Entry Id',
      in: 'Interlinearization',
      lo1: 'native-1',
      lo2: 'native-2',
      lx: 'Lexeme/Word/Phrase',
      mr: 'Morphology',
      nc: 'Noun class',
      nt: 'Notes',
      pfFriendlyName: 'Image filename',
      ph: 'Phonetic (IPA)',
      pl: 'Plural form',
      ps: 'Part of Speech',
      psab: 'Part of Speech abbreviation',
      sd1: 'Semantic domain 1',
      sd2: 'Semantic domain 2',
      sd3: 'Semantic domain 3',
      sfFriendlyName: 'Audio filename',
      sfbp: 'Speaker birthplace',
      sfde: 'Speaker decade',
      sfge: 'Speaker gender',
      sfsn: 'Speaker name',
      sr: 'Source(s)',
      xsar: 'Example sentence in Arabic',
      xsen: 'Example sentence in English',
      xsvn: 'Example sentence in TestLang',
    },
    {
      di: 'dialect x',
      glar: 'foo',
      glen: 'banana',
      id: '12345qwerty',
      in: 'n',
      lo1: 'کیلا',
      lo2: '',
      lx: 'xiangjiao',
      mr: 'bar',
      nc: '5',
      nt: 'This is an example of a note, here we can write whatever we want.',
      pfFriendlyName: '12345qwerty_platano.mp3',
      pfpa: 'https://database.com/image.mp3',
      ph: 'xiangjiao',
      pl: 'shuang xiangjiao',
      ps: 'noun',
      psab: 'n',
      sd1: 'Plant Test Domain',
      sd2: '',
      sd3: '',
      sfFriendlyName: '12345qwerty_platano.mp3',
      sfbp: 'Whoville',
      sfde: '4',
      sfge: 'm',
      sfpa: 'https://database.com/sound.mp3',
      sfsn: 'John Smith',
      sr: 'A book | www.mybook.com',
      xsar: undefined,
      xsen: 'This is a banana',
      xsvn: '我很喜歡吃香蕉',
    },
    {
      di: undefined,
      glar: '',
      glen: '',
      id: '34qw',
      in: undefined,
      lo1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
      lo2: 'চুড়া বংজি',
      lx: 'tree',
      mr: undefined,
      nc: undefined,
      nt: '',
      pfFriendlyName: '',
      ph: undefined,
      pl: undefined,
      ps: '',
      psab: '',
      sd1: '',
      sd2: '',
      sd3: '',
      sfFriendlyName: '',
      sfbp: '',
      sfde: '',
      sfge: '',
      sfsn: '',
      sr: '',
      xsar: undefined,
      xsen: undefined,
      xsvn: undefined,
    },
  ];
  test.fails('formatEntriesForCSV basic example to smoke test with GoalDatabaseEntry', () => {
    const goal_entries_array: IEntry[] = [
      {
        id: '12345qwerty',
        lx: 'xiangjiao',
        lo: 'کیلا',
        in: 'n',
        mr: 'bar',
        sn: [
          {
            gl: { es: 'platano', ar: 'foo', en: 'banana' },
            nc: '5',
            ps: ['n'],
            sdn: ['2.1', '2.2', '2.3'],
            xs: [{ en: 'This is a banana', vn: '我很喜歡吃香蕉' }],
            pfs: [{ gcs: 'not_needed_here', path: 'https://database.com/image.mp3' }],
          },
        ],
        ph: 'xiangjiao',
        pl: 'shuang xiangjiao',
        di: 'dialect x',
        nt: 'This is an example of a note, here we can write whatever we want.',
        sr: ['A book', 'www.mybook.com'],
        sfs: [{ path: 'https://database.com/sound.mp3', sp: ['123'] }],
      },
      {
        id: '34qw',
        lx: 'tree',
        lo2: 'চুড়া বংজি',
        lo1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
        sn: [{ gl: { es: 'arbol' } }],
      },
    ];

    const semanticDomains: ISemanticDomain[] = [{ key: '2.1', name: 'Plant Test Domain' }];
    const partsOfSpeech: IPartOfSpeech[] = [{ enAbbrev: 'n', enName: 'noun' }];
    expect(
      formatEntriesForCSV(goal_entries_array, dictionary, speakers, semanticDomains, partsOfSpeech)
    ).toStrictEqual(expected);
  });

  test('formatEntriesForCSV basic example to smoke test with DeprecatedEntry', () => {
    const deprecated_entries_array: ActualDatabaseEntry[] = [
      {
        id: '12345qwerty',
        lx: 'xiangjiao',
        lo: 'کیلا',
        in: 'n',
        mr: 'bar',
        nc: '5',
        ph: 'xiangjiao',
        gl: { es: 'platano', ar: 'foo', en: 'banana' },
        ps: 'n',
        pl: 'shuang xiangjiao',
        sdn: ['2.1', '2.2', '2.3'],
        di: 'dialect x',
        nt: 'This is an example of a note, here we can write whatever we want.',
        sr: ['A book', 'www.mybook.com'],
        xs: { en: 'This is a banana', vn: '我很喜歡吃香蕉' },
        sf: { path: 'https://database.com/sound.mp3', sp: '123' },
        pf: { gcs: 'not_needed_here', path: 'https://database.com/image.mp3' },
        xv: '',
      },
      { id: '34qw', lx: 'tree', lo2: 'চুড়া বংজি', lo: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤', gl: { es: 'arbol' } },
    ];

    expect(
      formatEntriesForCSV(
        deprecated_entries_array,
        dictionary,
        speakers,
        semanticDomains,
        partsOfSpeech
      )
    ).toStrictEqual(expected);
  });
});
