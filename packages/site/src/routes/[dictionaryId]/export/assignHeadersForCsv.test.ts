// import type { ExpandedEntry } from '@living-dictionaries/types'
import {
  // get_example_sentence_headers,
  get_gloss_language_headers,
  get_local_orthography_headers,
  get_semantic_domain_headers,
} from './assignHeadersForCsv'

describe(get_local_orthography_headers, () => {
  test('assigns alternate_orthographies if any exists', () => {
    const alternate_orthographies = ['native-1', 'native-2', 'native-3']
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({
      'localOrthography': 'native-1',
      'localOrthography.2': 'native-2',
      'localOrthography.3': 'native-3',
    })
  })
  test('doesn\'t assign alternate_orthographies if empty array', () => {
    const alternate_orthographies = []
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({})
  })
  test('doesn\'t assign alternate_orthographies if null', () => {
    const alternate_orthographies = null
    expect(get_local_orthography_headers(alternate_orthographies)).toEqual({})
  })
})

describe(get_semantic_domain_headers, () => {
  test('adds semantic domain headers if any exists', () => {
    const semantic_domains = ['NA', 'NA', 'NA']
    const first_sense_index = 0
    expect(get_semantic_domain_headers(semantic_domains, first_sense_index)).toEqual({
      'semanticDomain': 'Semantic domain 1',
      'semanticDomain.2': 'Semantic domain 2',
      'semanticDomain.3': 'Semantic domain 3',
    })
  })

  test('adds semantic domain to third sense', () => {
    const third_sense_index = 2
    const semantic_domains = ['NA', 'NA']
    expect(get_semantic_domain_headers(semantic_domains, third_sense_index)).toEqual({
      's3.semanticDomain': 'Semantic domain 1',
      's3.semanticDomain.2': 'Semantic domain 2',
    })
  })

  test('does not add semantic domain headers if none exist', () => {
    const first_sense_index = 0
    const semantic_domains = []
    expect(get_semantic_domain_headers(semantic_domains, first_sense_index)).toEqual({})
  })
})

describe(get_gloss_language_headers, () => {
  const first_sense_index = 0
  test('uses full name or bcp if it no name exists', () => {
    const glosses = { ar: 'فغي', en: 'red', es: 'rojo' }
    expect(get_gloss_language_headers(glosses, first_sense_index)).toEqual({
      ar_gloss: 'العَرَبِيَّة‎ Gloss',
      en_gloss: 'English Gloss',
      es_gloss: 'español Gloss',
    })
  })
  test('uses glosses in second sense', () => {
    const second_sense_index = 1
    const glosses = { en: 'blue', es: 'azul' }
    expect(get_gloss_language_headers(glosses, second_sense_index)).toEqual({
      's2.en_gloss': 'English Gloss',
      's2.es_gloss': 'español Gloss',
    })
  })
  test('doesn\'t assign gloss languages if empty array', () => {
    const glosses = {}
    expect(get_gloss_language_headers(glosses, first_sense_index)).toEqual({})
  })
  test('doesn\'t assign gloss languages if null', () => {
    const glosses = null
    expect(get_gloss_language_headers(glosses, first_sense_index)).toEqual({})
  })
})

// describe(get_example_sentence_headers, () => {
//   test('assigns vernacular and other example sentences if any exists or bcp if it doesn\'t', () => {
//     const gloss_languages = ['it', 'af']
//     const dictionary_name = 'Foo'
//     expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
//       vernacular_example_sentence: 'Example sentence in Foo',
//       it_example_sentence: 'Example sentence in Italiano',
//       af_example_sentence: 'Example sentence in Afrikaans',
//     })
//   })
//   test('assigns only verncaular if empty array', () => {
//     const gloss_languages = []
//     const dictionary_name = 'Baz'
//     expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
//       vernacular_example_sentence: 'Example sentence in Baz',
//     })
//   })
//   test('doesn\'t assign gloss languages if null', () => {
//     const gloss_languages = null
//     const dictionary_name = 'Boo'
//     expect(get_example_sentence_headers(gloss_languages, dictionary_name)).toEqual({
//       vernacular_example_sentence: 'Example sentence in Boo',
//     })
//   })
// })
