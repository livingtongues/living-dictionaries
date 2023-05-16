import type {
  ExpandedEntry,
  IDictionary,
  ISpeaker,
  ISemanticDomain,
  IPartOfSpeech,
} from '@living-dictionaries/types';
import {
  prepareEntriesForCsv,
  assign_local_orthographies_to_headers,
  count_maximum_semantic_domains_only_from_first_senses,
  assign_total_semantic_domains_from_first_sense_to_headers,
  assign_gloss_languages_to_headers,
  assign_example_sentences_to_headers,
  find_part_of_speech,
  type EntryForCSV,
} from './prepareEntriesForCsv';

describe('assign_local_orthographies_to_headers', () => {
  test('assigns alternate_orthographies if any exists', () => {
    const headers = {} as EntryForCSV;
    const alternate_orthographies = ['native-1', 'native-2'];
    assign_local_orthographies_to_headers(headers, alternate_orthographies);
    expect(headers).toEqual({
      local_orthography_1: 'native-1',
      local_orthography_2: 'native-2',
    });
  });
  test("doesn't assign alternate_orthographies if empty array", () => {
    const headers = {} as EntryForCSV;
    const alternate_orthographies = [];
    assign_local_orthographies_to_headers(headers, alternate_orthographies);
    expect(headers).toEqual({});
  });
  test("doesn't assign alternate_orthographies if null", () => {
    const headers = {} as EntryForCSV;
    const alternate_orthographies = null;
    assign_local_orthographies_to_headers(headers, alternate_orthographies);
    expect(headers).toEqual({});
  });
});

describe('count_maximum_semantic_domains_only_from_first_senses', () => {
  test('counts the maximum number of the semantic domains in the first sense of each entry', () => {
    const entries = [
      {
        lexeme: 'foo',
        senses: [{ semantic_domains: ['1.2'] }],
      },
      {
        lexeme: 'bar',
        senses: [{ semantic_domains: ['2.1', '2.2', '2.3'] }],
      },
    ];
    expect(count_maximum_semantic_domains_only_from_first_senses(entries)).toEqual(3);
  });
  test("returns 0 if there's only empty arrays or null values in semantic_doains", () => {
    const entries = [
      {
        lexeme: 'foo',
        senses: [],
      },
      {
        lexeme: 'bar',
      },
    ];
    expect(count_maximum_semantic_domains_only_from_first_senses(entries)).toEqual(0);
  });
});

describe('assign_total_semantic_domains_from_first_sense_to_headers', () => {
  test('assigns semantic domains if any exists', () => {
    const headers = {} as EntryForCSV;
    const max_semantic_domain_number = 3;
    assign_total_semantic_domains_from_first_sense_to_headers(headers, max_semantic_domain_number);
    expect(headers).toEqual({
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
      semantic_domain_3: 'Semantic domain 3',
    });
  });
  test("doesn't assign semantic domains if none", () => {
    const headers = {} as EntryForCSV;
    const max_semantic_domain_number = 0;
    assign_total_semantic_domains_from_first_sense_to_headers(headers, max_semantic_domain_number);
    expect(headers).toEqual({});
  });
});

describe('assign_gloss_languages_to_headers', () => {
  test("assigns gloss languages if any exists or bcp if it doesn't", () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = ['en', 'es', 'af'];
    assign_gloss_languages_to_headers(headers, gloss_languages);
    expect(headers).toEqual({
      en_gloss_language: 'English Gloss',
      es_gloss_language: 'español Gloss',
      af_gloss_language: 'af Gloss',
    });
  });
  test("Doesn't assign gloss languages if empty array", () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = [];
    assign_gloss_languages_to_headers(headers, gloss_languages);
    expect(headers).toEqual({});
  });
  test("Doesn't assign gloss languages if null", () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = null;
    assign_gloss_languages_to_headers(headers, gloss_languages);
    expect(headers).toEqual({});
  });
});

describe('assign_example_sentences_to_headers', () => {
  test("assigns vernacular and other example sentences if any exists or bcp if it doesn't", () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = ['it', 'af'];
    const dictionary_name = 'Foo';
    assign_example_sentences_to_headers(headers, gloss_languages, dictionary_name);
    expect(headers).toEqual({
      vernacular_example_sentence: 'Example sentence in Foo',
      it_example_sentence: 'Example sentence in Italiano',
      af_example_sentence: 'Example sentence in af',
    });
  });
  test('Assigns only verncaular if empty array', () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = [];
    const dictionary_name = 'Baz';
    assign_example_sentences_to_headers(headers, gloss_languages, dictionary_name);
    expect(headers).toEqual({
      vernacular_example_sentence: 'Example sentence in Baz',
    });
  });
  test("Doesn't assign gloss languages if null", () => {
    const headers = {} as EntryForCSV;
    const gloss_languages = null;
    const dictionary_name = 'Boo';
    assign_example_sentences_to_headers(headers, gloss_languages, dictionary_name);
    expect(headers).toEqual({
      vernacular_example_sentence: 'Example sentence in Boo',
    });
  });
});

describe('find_part_of_speech', () => {
  //TODO null test
  test('should', () => {
    const parts_of_speech = [
      {
        enAbbrev: 'n',
        enName: 'noun',
      },
    ];
    const part_of_speech_abbreviation = 'n';
    expect(find_part_of_speech(parts_of_speech, part_of_speech_abbreviation)).toEqual('noun');
  });
});

describe('prepareEntriesForCsv', () => {
  const headerRow = {
    id: 'Entry Id',
    lexeme: 'Lexeme/Word/Phrase',
    phonetic: 'Phonetic (IPA)',
    interlinearization: 'Interlinearization',
    noun_class: 'Noun class',
    morphology: 'Morphology',
    plural_form: 'Plural form',
    dialects: 'Dialects',
    notes: 'Notes',
    sources: 'Source(s)',
    parts_of_speech_abbreviation: 'Part of Speech abbreviation',
    parts_of_speech: 'Part of Speech',
    sound_filename: 'Audio filename',
    speaker_name: 'Speaker name',
    speaker_birthplace: 'Speaker birthplace',
    speaker_decade: 'Speaker decade',
    speaker_gender: 'Speaker gender',
    image_filename: 'Image filename',
    // dynamic fields - you can use easier to read field names
    local_orthography_1: 'native_script_1',
    local_orthography_2: 'native_script_2',
    ar_example_sentence: 'Example sentence in العَرَبِيَّة‎',
    ar_gloss_language: 'العَرَبِيَّة‎ Gloss',
    en_example_sentence: 'Example sentence in English',
    en_gloss_language: 'English Gloss',
    semantic_domain_1: 'Semantic domain 1',
    semantic_domain_2: 'Semantic domain 2',
    semantic_domain_3: 'Semantic domain 3',
    vernacular_example_sentence: 'Example sentence in TestLang',
  };

  const dictionary: IDictionary = {
    name: 'TestLang',
    id: 'test',
    glossLanguages: ['ar', 'en', 'en'],
    alternateOrthographies: ['native_script_1', 'native_script_2'],
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

  test('works', () => {
    const expanded_entries: ExpandedEntry[] = [
      {
        id: '12345qwerty',
        lexeme: 'xiangjiao',
        local_orthography_2: 'کیلا',
        senses: [
          {
            glosses: { ar: 'foo', en: 'banana' },
            parts_of_speech: ['n', 'adj'],
            semantic_domains: ['2.1', '2.2', '2.3'],
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
        local_orthography_2: 'চুড়া বংজি',
        local_orthography_1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
        senses: [{ glosses: { es: 'árbol' } }],
      },
    ];
    //TODO after make everything passes, allow multiple parts of speech
    const expected = [
      {
        ...headerRow,
      },
      {
        dialects: 'dialect x',
        id: '12345qwerty',
        image_filename: '',
        interlinearization: '',
        lexeme: 'xiangjiao',
        morphology: '',
        native_script_2: 'کیلا',
        notes: 'This is an example of a note, here we can write whatever we want.',
        noun_class: '',
        parts_of_speech: 'noun',
        parts_of_speech_abbreviation: 'n',
        phonetic: 'xiangjiao',
        plural_form: '',
        sound_filename: 'https://database.com/sound.mp3',
        sources: 'A book | www.mybook.com',
        speaker_birthplace: 'Whoville',
        speaker_decade: '41-50',
        speaker_gender: 'male',
        speaker_name: 'John Smith',
        ar_gloss_language: 'foo',
        en_gloss_language: 'banana',
        en_example_sentence: 'This is a banana',
        vernacular_example_sentence: '我很喜歡吃香蕉',
      },
      {
        dialects: '',
        id: '34qw',
        image_filename: '',
        interlinearization: '',
        lexeme: 'tree',
        morphology: '',
        native_script_1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
        native_script_2: 'চুড়া বংজি',
        notes: '',
        noun_class: '',
        parts_of_speech: '',
        parts_of_speech_abbreviation: '',
        phonetic: '',
        plural_form: '',
        sound_filename: '',
        sources: '',
        speaker_birthplace: '',
        speaker_decade: '',
        speaker_gender: '',
        speaker_name: '',
        es_gloss_language: 'árbol',
      },
    ];
    expect(
      prepareEntriesForCsv(expanded_entries, dictionary, speakers, semanticDomains, partsOfSpeech)
    ).toEqual(expected);
  });
});

// 3) then go and make sure export/+page.svelte is happy
