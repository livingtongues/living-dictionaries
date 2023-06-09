import type { EntryForCSV } from './prepareEntriesForCsv';
import type { ExpandedEntry, ISpeaker, IEntry } from '@living-dictionaries/types';
import {
  find_part_of_speech_abbreviation,
  get_first_speaker_from_first_sound_file,
  display_speaker_gender,
  format_local_orthographies,
  format_semantic_domains,
  format_gloss_languages,
  format_example_sentences,
} from './assignFormattedEntryValuesForCsv';

describe('find_part_of_speech_abbreviation', () => {
  const global_parts_of_speech = [
    {
      enAbbrev: 'n',
      enName: 'noun',
    },
  ];
  
  test('finds readable part of speech name', () => {
    const part_of_speech = 'noun';
    expect(find_part_of_speech_abbreviation(global_parts_of_speech, part_of_speech)).toEqual('n');
  });

  test('return undefined if abbreviation does not exist', () => {
    const part_of_speech = null;
    expect(find_part_of_speech_abbreviation(global_parts_of_speech, part_of_speech)).toEqual(
      undefined
    );
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
    expect(display_speaker_gender('')).toEqual(undefined);
    expect(display_speaker_gender(undefined)).toEqual(undefined);
  });
});

// describe('display_speaker_age_range', () => {
//   test('displays readable speaker age range', () => {
//     expect(display_speaker_age_range(3)).toEqual('31-40');
//   });
//   test('displays empty string if speaker age range is undefined', () => {
//     expect(display_speaker_age_range(undefined)).toEqual('');
//   });
// });

//formattedEntry tests
describe('format_local_orthographies', () => {
  test('assigns local orthography to formatted entry if value exist or assigns an empty string if does not', () => {
    const local_orthographies_headers = {
      local_orthography_1: 'script_1',
      local_orthography_2: 'script_2',
      local_orthography_3: 'script_3',
    } as EntryForCSV;
    const entry: ExpandedEntry = {
      lexeme: 'foo',
      local_orthography_3: 'example-3',
      local_orthography_2: 'example-2',
    };
    const expected = {
      local_orthography_1: undefined,
      local_orthography_2: 'example-2',
      local_orthography_3: 'example-3',
    };
    expect(format_local_orthographies(entry, local_orthographies_headers)).toEqual(expected);
  });
});

describe('format_semantic_domains', () => {
  test('assigns semantic domain to formatted entry if value exist or assigns an empty string if does not', () => {
    const entry: ExpandedEntry = {
      lexeme: 'baz',
      senses: [{ semantic_domains: ['Colors', 'Birds'] }],
    };
    const max_semantic_domain_number = 3;
    const expected = {
      semantic_domain_1: 'Colors',
      semantic_domain_2: 'Birds',
      semantic_domain_3: undefined,
    };
    expect(format_semantic_domains(entry, max_semantic_domain_number)).toEqual(expected);
  });
});

describe('format_gloss_languages', () => {
  test('assigns gloss languages values to formatted entry if value exist or assigns an empty string if does not', () => {
    const entry: ExpandedEntry = {
      lexeme: 'Boo',
      senses: [{ glosses: { es: 'oso' } }],
    };
    const gloss_languages = ['en', 'es'];
    const expected = {
      en_gloss_language: undefined,
      es_gloss_language: 'oso',
    };
    expect(format_gloss_languages(entry, gloss_languages)).toEqual(expected);
  });
});

describe('format_example_sentences', () => {
  test('assigns example sentences values to formatted entry if value exist or assigns an empty string if does not', () => {
    const entry: ExpandedEntry = {
      lexeme: 'Boo',
      senses: [{ example_sentences: [{ es: 'el oso es enorme' }] }],
    };
    const gloss_languages = ['en', 'es'];
    const expected = {
      en_example_sentence: undefined,
      es_example_sentence: 'el oso es enorme',
      vernacular_example_sentence: undefined,
    };
    expect(format_example_sentences(entry, gloss_languages)).toEqual(expected);
  });

  test('assigns vernacular example sentence value to formatted entry if any gloss languages exist', () => {
    const entry: ExpandedEntry = {
      lexeme: 'min',
      senses: [{ example_sentences: [{ vn: 'native example' }] }],
    };
    const gloss_languages = [];
    const expected = {
      vernacular_example_sentence: 'native example',
    };
    expect(format_example_sentences(entry, gloss_languages)).toEqual(expected);
  });
});
