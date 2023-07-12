import {
  get_local_orthography_headers,
  get_semantic_domain_headers,
  get_gloss_language_headers,
  get_example_sentence_headers,
} from './assignHeadersForCsv';

describe(get_local_orthography_headers, () => {
  test('assigns alternate_orthographies if any exists', () => {
    const alternate_orthographies = ['native-1', 'native-2'];
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({
      local_orthography_1: 'native-1',
      local_orthography_2: 'native-2',
    });
  });
  test('doesn\'t assign alternate_orthographies if empty array', () => {
    const alternate_orthographies = [];
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({});
  });
  test('doesn\'t assign alternate_orthographies if null', () => {
    const alternate_orthographies = null;
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({});
  });
});

describe(get_semantic_domain_headers, () => {
  test('adds semantic domain headers if any exists', () => {
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
    expect(get_semantic_domain_headers(entries)).toEqual({
      semantic_domain_1: 'Semantic domain 1',
      semantic_domain_2: 'Semantic domain 2',
      semantic_domain_3: 'Semantic domain 3',
    });
  });

  test('does not add semantic domain headers if none exist', () => {
    const entries = [
      {
        lexeme: 'foo',
        senses: [],
      },
      {
        lexeme: 'bar',
      },
    ];
    expect(get_semantic_domain_headers(entries)).toEqual({});
  });
});

describe(get_gloss_language_headers, () => {
  test('Using full name or bcp if it no name exists', () => {
    const gloss_languages = ['en', 'es', 'af'];
    expect(get_gloss_language_headers(gloss_languages)).toEqual({
      en_gloss_language: 'English Gloss',
      es_gloss_language: 'español Gloss',
      af_gloss_language: 'af Gloss',
    });
  });
  test('Doesn\'t assign gloss languages if empty array', () => {
    const gloss_languages = [];
    expect(get_gloss_language_headers(gloss_languages)).toEqual({});
  });
  test('Doesn\'t assign gloss languages if null', () => {
    const gloss_languages = null;
    expect(get_gloss_language_headers(gloss_languages)).toEqual({});
  });
});

describe(get_example_sentence_headers, () => {
  test('assigns vernacular and other example sentences if any exists or bcp if it doesn\'t', () => {
    const gloss_languages = ['it', 'af'];
    const dictionary_name = 'Foo';
    expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Foo',
      it_example_sentence: 'Example sentence in Italiano',
      af_example_sentence: 'Example sentence in af',
    });
  });
  test('Assigns only verncaular if empty array', () => {
    const gloss_languages = [];
    const dictionary_name = 'Baz';
    expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Baz',
    });
  });
  test('Doesn\'t assign gloss languages if null', () => {
    const gloss_languages = null;
    const dictionary_name = 'Boo';
    expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
      vernacular_example_sentence: 'Example sentence in Boo',
    });
  });
});
