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
  assign_total_semantic_domains_from_first_sense_to_headers,
  assign_gloss_languages_to_headers,
  assign_example_sentences_to_headers,
  type EntryForCSV,
} from './prepareEntriesForCsv';

describe('assign_local_orthographies_to_headers', () => {
  test('assigns alternate_orthographies if any exists', () => {
    const headers = {} as EntryForCSV;
    const alternate_orthographies = ['native-1', 'native-2'];
    assign_local_orthographies_to_headers(headers, alternate_orthographies);
    expect(headers).toEqual({
      local_orthographies_1: 'native-1',
      local_orthographies_2: 'native-2',
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

describe('assign_total_semantic_domains_from_first_sense_to_headers', () => {
  test('assigns semantic domains if any exists', () => {
    const headers = {} as EntryForCSV;
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
    assign_total_semantic_domains_from_first_sense_to_headers(headers, entries);
    expect(headers).toEqual({
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
      semantic_domain_3: 'Semantic domain 3',
    });
  });
  test("doesn't assign semantic domains if none", () => {
    const headers = {} as EntryForCSV;
    const entries = [
      {
        lexeme: 'foo',
        senses: [],
      },
      {
        lexeme: 'bar',
      },
    ];
    assign_total_semantic_domains_from_first_sense_to_headers(headers, entries);
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
    // glar: 'Arabic Gloss',
    // glen: 'English Gloss',
    // lo1: 'native-1',
    // lo2: 'native-2',
    // sd1: 'Semantic domain 1',
    // sd2: 'Semantic domain 2',
    // sd3: 'Semantic domain 3',
  };
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

  test('works', () => {
    const expanded_entries: ExpandedEntry[] = [
      {
        //local_orthography_1: 'foo',
        lexeme: 'foo',
        // 1) fill out a couple entries
      },
    ];
    const expected: EntryForCSV[] = [
      { ...headerRow },
      {
        // 2) then their expected form for the CSV
        lexeme: 'foo',
        phonetic: '',
        interlinearization: '',
        noun_class: '',
        morphology: '',
        plural_form: '',
        dialects: '',
        notes: '',
        sources: '',
        parts_of_speech_abbreviation: '',
        parts_of_speech: '',
        sound_filename: '',
        speaker_name: '',
        speaker_birthplace: '',
        speaker_decade: '',
        speaker_gender: '',
        image_filename: '',
      },
    ];
    expect(
      prepareEntriesForCsv(expanded_entries, dictionary, speakers, semanticDomains, partsOfSpeech)
    ).toEqual(expected);
  });
});

// 3) then go and make sure export/+page.svelte is happy
