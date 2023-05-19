import type {
  ExpandedEntry,
  IDictionary,
  ISpeaker,
  ISemanticDomain,
  IPartOfSpeech,
} from '@living-dictionaries/types';
import { prepareEntriesForCsv } from './prepareEntriesForCsv';

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

  test('basic example to smoke test with ExpandedEntry', () => {
    const dictionary: IDictionary = {
      name: 'TestLang',
      id: 'test',
      glossLanguages: ['ar', 'en', 'es'],
      alternateOrthographies: ['native_script_1', 'native_script_2'],
      entryCount: 2,
    };
    const expanded_entries: ExpandedEntry[] = [
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
    expect(prepareEntriesForCsv(expanded_entries, dictionary, speakers, partsOfSpeech)).toEqual(
      expected
    );
  });
  test('super simple example to show variant column', () => {
    const dictionary: IDictionary = {
      name: 'Babanki example',
      id: 'babanki',
      glossLanguages: [],
      entryCount: 2,
    };
    const expanded_entries: ExpandedEntry[] = [
      {
        lexeme: 'foo',
        variant: 'new variant',
      },
      {
        lexeme: 'baz',
      },
    ];
    expect(prepareEntriesForCsv(expanded_entries, dictionary, speakers, partsOfSpeech)).toEqual([
      {
        dialects: 'Dialects',
        id: 'Entry Id',
        image_filename: 'Image filename',
        interlinearization: 'Interlinearization',
        lexeme: 'Lexeme/Word/Phrase',
        morphology: 'Morphology',
        notes: 'Notes',
        noun_class: 'Noun class',
        parts_of_speech: 'Part of Speech',
        parts_of_speech_abbreviation: 'Part of Speech abbreviation',
        phonetic: 'Phonetic (IPA)',
        plural_form: 'Plural form',
        sound_filename: 'Audio filename',
        sources: 'Source(s)',
        speaker_birthplace: 'Speaker birthplace',
        speaker_decade: 'Speaker decade',
        speaker_gender: 'Speaker gender',
        speaker_name: 'Speaker name',
        variant: 'Variant',
        vernacular_example_sentence: 'Example sentence in Babanki example',
      },
      {
        dialects: '',
        id: '',
        image_filename: '',
        interlinearization: '',
        lexeme: 'foo',
        morphology: '',
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
        variant: 'new variant',
        vernacular_example_sentence: '',
      },
      {
        dialects: '',
        id: '',
        image_filename: '',
        interlinearization: '',
        lexeme: 'baz',
        morphology: '',
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
        variant: '',
        vernacular_example_sentence: '',
      },
    ]);
  });
});

// 3) then go and make sure export/+page.svelte is happy
