import type {
  ExpandedEntry,
  IDictionary,
  ISpeaker,
  IPartOfSpeech,
} from '@living-dictionaries/types';
import { StandardEntryCSVFields, prepareEntriesForCsv } from './prepareEntriesForCsv';
import { objectsToCsvByHeaders } from '$lib/export/csv';

describe('prepareEntriesForCsv', () => {
  const speakers: ISpeaker[] = [
    {
      displayName: 'John Smith',
      id: '123',
      birthplace: 'Whoville',
      decade: 4,
      gender: 'm',
    },
  ];
  const partsOfSpeech: IPartOfSpeech[] = [{ enAbbrev: 'n', enName: 'noun' }]; // TODO: after updated expanded entries to include abbreviations, this will no longer be needed in prepareEntriesForCsv

  test('everything', () => {
    const dictionary: IDictionary = {
      name: 'TestLang',
      id: 'testDictionary',
      glossLanguages: ['ar', 'en', 'es'],
      alternateOrthographies: ['native_script_1', 'native_script_2'],
    };
    const entries: ExpandedEntry[] = [
      {
        id: '12345qwerty',
        lexeme: 'xiangjiao',
        local_orthography_2: 'کیلا',
        senses: [
          {
            glosses: { ar: 'foo', en: 'banana' },
            parts_of_speech: ['noun', 'adjective'],
            semantic_domains: ['Body parts', 'Body functions'],
            example_sentences: [{ en: 'This is a banana', vn: '我很喜歡吃香蕉' }],
            photo_files: [
              { fb_storage_path: 'https://database.com/image.png', uid_added_by: 'Diego' },
            ],
          },
        ],
        phonetic: 'xiangjiao',
        dialects: ['dialect x'],
        notes: 'This is an example of a note, here we can write whatever we want.',
        sources: ['A book', 'www.mybook.com'],
        sound_files: [{ fb_storage_path: 'https://database.com/sound.mp3', speaker_ids: ['123'] }],
      },
      {
        id: '34qw',
        lexeme: 'tree',
        local_orthography_1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
        local_orthography_2: 'চুড়া বংজি',
        senses: [{ glosses: { es: 'árbol' } }],
      },
    ];
    const [headerRow, firstEntry, secondEntry] = prepareEntriesForCsv(
      entries,
      dictionary,
      speakers,
      partsOfSpeech
    );

    const expectedHeaders_PlusDynamic_ArEnEs_TwoLocalOrthographies = {
      ...StandardEntryCSVFields,
      local_orthography_1: 'native_script_1',
      local_orthography_2: 'native_script_2',
      ar_gloss_language: 'العَرَبِيَّة‎ Gloss',
      en_gloss_language: 'English Gloss',
      es_gloss_language: 'español Gloss',
      ar_example_sentence: 'Example sentence in العَرَبِيَّة‎',
      en_example_sentence: 'Example sentence in English',
      es_example_sentence: 'Example sentence in español',
      vernacular_example_sentence: 'Example sentence in TestLang',
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
    };
    expect(headerRow).toMatchObject(expectedHeaders_PlusDynamic_ArEnEs_TwoLocalOrthographies);

    expect(firstEntry).toMatchSnapshot();
    expect(secondEntry).toMatchSnapshot();

    expect(objectsToCsvByHeaders(headerRow, [firstEntry, secondEntry])).toMatchFileSnapshot('./test-output/prepareEntriesForCsv.csv');
  });

  //TODO after make everything passes, allow multiple parts of speech

  describe('variant column', () => {
    test('added to babanki', () => {
      const dictionary = { id: 'babanki', glossLanguages: [] } as IDictionary;
      const entries: ExpandedEntry[] = [
        {
          lexeme: 'foo',
          variant: 'fooey',
        },
        {
          lexeme: 'baz',
        },
      ];
      const [headerRow, firstEntry, secondEntry] = prepareEntriesForCsv(
        entries,
        dictionary,
        speakers,
        partsOfSpeech
      );

      expect(headerRow.variant).toEqual('Variant');
      expect(firstEntry.variant).toEqual('fooey');
      expect(secondEntry.variant).toEqual(undefined);
    });

    test('not added to fooDictionary', () => {
      const dictionary = { id: 'fooDictionary', glossLanguages: [] } as IDictionary;
      const entries: ExpandedEntry[] = [{ lexeme: 'foo' }];
      const [headerRow] = prepareEntriesForCsv(entries, dictionary, speakers, partsOfSpeech);
      expect(headerRow.variant).toBeFalsy();
    });
  });
});
