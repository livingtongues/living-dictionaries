import type { EntryForCSV } from './prepareEntriesForCsv';
import type { ExpandedEntry, ISpeaker, ISemanticDomain, IEntry } from '@living-dictionaries/types';
import {
  find_part_of_speech,
  get_first_speaker_from_first_sound_file,
  display_speaker_gender,
  display_speaker_age_range,
  assign_local_orthographies_to_formatted_entry,
  assign_semantic_domains_to_formatted_entry,
  assign_gloss_languages_to_formatted_entry,
  assign_example_sentences_to_formatted_entry,
} from './assignFormattedEntryValuesForCsv';

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
