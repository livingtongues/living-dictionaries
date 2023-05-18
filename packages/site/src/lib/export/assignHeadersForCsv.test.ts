import {
  assign_local_orthographies_to_headers,
  count_maximum_semantic_domains_only_from_first_senses,
  assign_semantic_domains_to_headers,
  assign_gloss_languages_to_headers,
  assign_example_sentences_to_headers,
} from './assignHeadersForCsv';
import type { EntryForCSV } from './prepareEntriesForCsv';

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
