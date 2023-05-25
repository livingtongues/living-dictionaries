import {
  assign_local_orthographies_as_headers,
  count_maximum_semantic_domains_only_from_first_senses,
  assign_semantic_domains_as_headers,
  assign_gloss_languages_as_headers,
  assign_example_sentences_as_headers,
} from './assignHeadersForCsv';

describe('assign_local_orthographies_as_headers', () => {
  test('assigns alternate_orthographies if any exists', () => {
    const alternate_orthographies = ['native-1', 'native-2'];
    expect(assign_local_orthographies_as_headers(alternate_orthographies)).toEqual({
      local_orthography_1: 'native-1',
      local_orthography_2: 'native-2',
    });
  });
  test("doesn't assign alternate_orthographies if empty array", () => {
    const alternate_orthographies = [];
    expect(assign_local_orthographies_as_headers(alternate_orthographies)).toEqual({});
  });
  test("doesn't assign alternate_orthographies if null", () => {
    const alternate_orthographies = null;
    expect(assign_local_orthographies_as_headers(alternate_orthographies)).toEqual({});
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

describe('assign_semantic_domains_as_headers', () => {
  test('assigns semantic domains if any exists', () => {
    const max_semantic_domain_number = 3;
    expect(assign_semantic_domains_as_headers(max_semantic_domain_number)).toEqual({
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
      semantic_domain_3: 'Semantic domain 3',
    });
  });
  test("doesn't assign semantic domains if none", () => {
    const max_semantic_domain_number = 0;
    expect(assign_semantic_domains_as_headers(max_semantic_domain_number)).toEqual({});
  });
});

describe('assign_gloss_languages_as_headers', () => {
  test("assigns gloss languages if any exists or bcp if it doesn't", () => {
    const gloss_languages = ['en', 'es', 'af'];
    expect(assign_gloss_languages_as_headers(gloss_languages)).toEqual({
      en_gloss_language: 'English Gloss',
      es_gloss_language: 'español Gloss',
      af_gloss_language: 'af Gloss',
    });
  });
  test("Doesn't assign gloss languages if empty array", () => {
    const gloss_languages = [];
    expect(assign_gloss_languages_as_headers(gloss_languages)).toEqual({});
  });
  test("Doesn't assign gloss languages if null", () => {
    const gloss_languages = null;
    expect(assign_gloss_languages_as_headers(gloss_languages)).toEqual({});
  });
});

describe('assign_example_sentences_as_headers', () => {
  test("assigns vernacular and other example sentences if any exists or bcp if it doesn't", () => {
    const gloss_languages = ['it', 'af'];
    const dictionary_name = 'Foo';
    expect(assign_example_sentences_as_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Foo',
      it_example_sentence: 'Example sentence in Italiano',
      af_example_sentence: 'Example sentence in af',
    });
  });
  test('Assigns only verncaular if empty array', () => {
    const gloss_languages = [];
    const dictionary_name = 'Baz';
    expect(assign_example_sentences_as_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Baz',
    });
  });
  test("Doesn't assign gloss languages if null", () => {
    const gloss_languages = null;
    const dictionary_name = 'Boo';
    expect(assign_example_sentences_as_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Boo',
    });
  });
});
