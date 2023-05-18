import type {
  ExpandedEntry,
  IDictionary,
  ISpeaker,
  ISemanticDomain,
  IPartOfSpeech,
  IEntry,
} from '@living-dictionaries/types';
import {
  prepareEntriesForCsv,
  assign_local_orthographies_to_headers,
  count_maximum_semantic_domains_only_from_first_senses,
  assign_semantic_domains_to_headers,
  assign_gloss_languages_to_headers,
  assign_example_sentences_to_headers,
  find_part_of_speech,
  get_first_speaker_from_first_sound_file,
  display_speaker_gender,
  display_speaker_age_range,
  assign_local_orthographies_to_formatted_entry,
  assign_semantic_domains_to_formatted_entry,
  assign_gloss_languages_to_formatted_entry,
  assign_example_sentences_to_formatted_entry,
  type EntryForCSV,
} from './prepareEntriesForCsv';

//headers tests
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

describe('assign_semantic_domains_to_headers', () => {
  test('assigns semantic domains if any exists', () => {
    const headers = {} as EntryForCSV;
    const max_semantic_domain_number = 3;
    assign_semantic_domains_to_headers(headers, max_semantic_domain_number);
    expect(headers).toEqual({
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
      semantic_domain_3: 'Semantic domain 3',
    });
  });
  test("doesn't assign semantic domains if none", () => {
    const headers = {} as EntryForCSV;
    const max_semantic_domain_number = 0;
    assign_semantic_domains_to_headers(headers, max_semantic_domain_number);
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
  const parts_of_speech = [
    {
      enAbbrev: 'n',
      enName: 'noun',
    },
  ];
  test('finds readable part of speech name', () => {
    const part_of_speech_abbreviation = 'n';
    expect(find_part_of_speech(parts_of_speech, part_of_speech_abbreviation)).toEqual('noun');
  });

  test('return empty string if abbreviation does not exist', () => {
    const part_of_speech_abbreviation = null;
    expect(find_part_of_speech(parts_of_speech, part_of_speech_abbreviation)).toEqual('');
  });
});

describe('get_first_speaker_from_first_sound_file', () => {
  test('gets speaker', () => {
    const speakers: ISpeaker[] = [
      {
        displayName: 'Arthur Morgan',
        id: 'rdr2',
        birthplace: 'New Hanover',
        decade: 3,
        gender: 'm',
      },
    ];
    const entry: IEntry = {
      lexeme: 'zoo',
      sound_files: [{ fb_storage_path: 'https://database.com/example.mp3', speaker_ids: ['rdr2'] }],
    };
    expect(get_first_speaker_from_first_sound_file(entry, speakers)).toEqual(speakers[0]);
  });
  test("gets undefined if there's no speaker", () => {
    const speakers: ISpeaker[] = [];
    const entry: IEntry = {
      lexeme: 'zoo',
      sound_files: [{ fb_storage_path: 'https://database.com/example.mp3', speaker_ids: ['rdr2'] }],
    };
    expect(get_first_speaker_from_first_sound_file(entry, speakers)).toEqual(undefined);
  });
});

describe('display_speaker_gender', () => {
  test('displays readable speaker gender', () => {
    expect(display_speaker_gender('m')).toEqual('male');
  });
  test('displays empty string if speaker gender it is an empty string or undefined', () => {
    expect(display_speaker_gender('')).toEqual('');
    expect(display_speaker_gender(undefined)).toEqual('');
  });
});

describe('display_speaker_age_range', () => {
  test('displays readable speaker age range', () => {
    expect(display_speaker_age_range(3)).toEqual('31-40');
  });
  test('displays empty string if speaker age range is undefined', () => {
    expect(display_speaker_age_range(undefined)).toEqual('');
  });
});

//formattedEntry tests
describe('assign_local_orthographies_to_formatted_entry', () => {
  test('assigns local orthography to formatted entry if value exist or assigns an empty string if does not', () => {
    const formatted_entry: EntryForCSV = {};
    const headers: EntryForCSV = {
      local_orthography_1: 'script_1',
      local_orthography_2: 'script_2',
      local_orthography_3: 'script_3',
    };
    const entry: ExpandedEntry = {
      lexeme: 'foo',
      local_orthography_3: 'example-3',
      local_orthography_2: 'example-2',
    };
    const alternate_orthographies = ['script_1', 'script_2', 'scriprt_3'];
    const expected = {
      script_1: '',
      script_2: 'example-2',
      script_3: 'example-3',
    };
    assign_local_orthographies_to_formatted_entry({
      formatted_entry,
      headers,
      entry,
      alternate_orthographies,
    });
    expect(formatted_entry).toEqual(expected);
  });
});
describe('assign_semantic_domains_to_formatted_entry', () => {
  test('assigns semantic domain to formatted entry if value exist or assigns an empty string if does not', () => {
    const formatted_entry: EntryForCSV = {};
    const entry: ExpandedEntry = {
      lexeme: 'baz',
      senses: [{ semantic_domains: ['1.6', '1.7'] }],
    };
    const max_semantic_domain_number = 3;
    const global_semantic_domains: ISemanticDomain[] = [
      { key: '1.5', name: 'Animals' },
      { key: '1.6', name: 'Colors' },
      { key: '1.7', name: 'Birds' },
    ];
    const expected = {
      semantic_domain_1: 'Colors',
      semantic_domain_2: 'Birds',
      semantic_domain_3: '',
    };
    assign_semantic_domains_to_formatted_entry({
      formatted_entry,
      entry,
      max_semantic_domain_number,
      global_semantic_domains,
    });
    expect(formatted_entry).toEqual(expected);
  });
});

describe('assign_gloss_languages_to_formatted_entry', () => {
  test('assigns gloss languages values to formatted entry if value exist or assigns an empty string if does not', () => {
    const formatted_entry: EntryForCSV = {};
    const entry: ExpandedEntry = {
      lexeme: 'Boo',
      senses: [{ glosses: { es: 'oso' } }],
    };
    const gloss_languages = ['en', 'es'];
    const expected = {
      en_gloss_language: '',
      es_gloss_language: 'oso',
    };
    assign_gloss_languages_to_formatted_entry({ formatted_entry, entry, gloss_languages });
    expect(formatted_entry).toEqual(expected);
  });
});

describe('assign_example_sentences_to_formatted_entry', () => {
  test('assigns example sentences values to formatted entry if value exist or assigns an empty string if does not', () => {
    const formatted_entry: EntryForCSV = {};
    const entry: ExpandedEntry = {
      lexeme: 'Boo',
      senses: [{ example_sentences: [{ es: 'el oso es enorme' }] }],
    };
    const gloss_languages = ['en', 'es'];
    const expected = {
      en_example_sentence: '',
      es_example_sentence: 'el oso es enorme',
      vernacular_example_sentence: '',
    };
    assign_example_sentences_to_formatted_entry({ formatted_entry, entry, gloss_languages });
    expect(formatted_entry).toEqual(expected);
  });
  test('assigns vernacular example sentence value to formatted entry if any gloss languages exist', () => {
    const formatted_entry: EntryForCSV = {};
    const entry: ExpandedEntry = {
      lexeme: 'min',
      senses: [{ example_sentences: [{ vn: 'native example' }] }],
    };
    const gloss_languages = [];
    const expected = {
      vernacular_example_sentence: 'native example',
    };
    assign_example_sentences_to_formatted_entry({ formatted_entry, entry, gloss_languages });
    expect(formatted_entry).toEqual(expected);
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

  const dictionary: IDictionary = {
    name: 'TestLang',
    id: 'test',
    glossLanguages: ['ar', 'en', 'es'],
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
  const semanticDomains: ISemanticDomain[] = [
    { key: '2.1', name: 'Body parts' },
    { key: '2.2', name: 'Body functions' },
  ];
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
            semantic_domains: ['2.1', '2.2'],
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
        image_filename: 'https://database.com/image.png',
        interlinearization: '',
        lexeme: 'xiangjiao',
        morphology: '',
        native_script_1: '',
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
        es_gloss_language: '',
        ar_example_sentence: '',
        en_example_sentence: 'This is a banana',
        es_example_sentence: '',
        vernacular_example_sentence: '我很喜歡吃香蕉',
        semantic_domain_1: 'Body parts',
        semantic_domain_2: 'Body functions',
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
        ar_gloss_language: '',
        en_gloss_language: '',
        es_gloss_language: 'árbol',
        ar_example_sentence: '',
        en_example_sentence: '',
        es_example_sentence: '',
        vernacular_example_sentence: '',
        semantic_domain_1: '',
        semantic_domain_2: '',
      },
    ];
    expect(
      prepareEntriesForCsv(expanded_entries, dictionary, speakers, semanticDomains, partsOfSpeech)
    ).toEqual(expected);
  });
});

// 3) then go and make sure export/+page.svelte is happy
