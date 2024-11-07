// import type { ExpandedEntry } from '@living-dictionaries/types'
import type { MultiString } from '@living-dictionaries/types'
import {
  get_example_sentence_headers,
  get_gloss_language_headers,
  get_image_files_headers,
  get_local_orthography_headers,
  get_parts_of_speech_headers,
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
describe(get_parts_of_speech_headers, () => {
  test('adds parts of speech headers if any exists', () => {
    const parts_of_speech_abbreviations = ['n', 'v']
    const parts_of_speech = ['noun', 'verb']
    const first_sense_index = 0
    expect(get_parts_of_speech_headers(parts_of_speech_abbreviations, parts_of_speech, first_sense_index)).toEqual({
      'partOfSpeech': 'Part of speech 1 (abbreviation)',
      'partOfSpeech.2': 'Part of speech 2 (abbreviation)',
      'partOfSpeech fullname': 'Part of speech 1',
      'partOfSpeech fullname.2': 'Part of speech 2',
    })
  })

  test('adds parts of speech to third sense', () => {
    const third_sense_index = 2
    const parts_of_speech_abbreviations = ['n', 'adj']
    const parts_of_speech = ['sustantivo', 'adjetivo']
    expect(get_parts_of_speech_headers(parts_of_speech_abbreviations, parts_of_speech, third_sense_index)).toEqual({
      's3.partOfSpeech': 'Part of speech 1 (abbreviation)',
      's3.partOfSpeech.2': 'Part of speech 2 (abbreviation)',
      's3.partOfSpeech fullname': 'Part of speech 1',
      's3.partOfSpeech fullname.2': 'Part of speech 2',
    })
  })

  test('does not add parts of speech headers if none exist', () => {
    const first_sense_index = 0
    const parts_of_speech_abbreviations = []
    const parts_of_speech = []
    expect(get_parts_of_speech_headers(parts_of_speech_abbreviations, parts_of_speech, first_sense_index)).toEqual({})
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

describe(get_example_sentence_headers, () => {
  const first_sense_index = 0
  test('assigns vernacular and translations', () => {
    // @ts-ignore
    const sentences: MultiString = { dictionary_id: 'example', text: { default: 'vernacular example sentence' }, translation: { en: 'English example sentence', es: 'Oración de ejemplo en español' } }
    expect(get_example_sentence_headers(sentences, first_sense_index)).toEqual({
      vernacular_exampleSentence: 'Example sentence in example',
      en_exampleSentence: 'Example sentence in English',
      es_exampleSentence: 'Example sentence in español',
    })
  })
  test('assigns vernacular and translations in fourth sense', () => {
    // @ts-ignore
    const sentences: MultiString = { dictionary_id: 'example', text: { default: 'vernacular example sentence' }, translation: { en: 'English example sentence', es: 'Oración de ejemplo en español' } }
    const fourth_sense_index = 3
    expect(get_example_sentence_headers(sentences, fourth_sense_index)).toEqual({
      's4.vernacular_exampleSentence': 'Example sentence in example',
      's4.en_exampleSentence': 'Example sentence in English',
      's4.es_exampleSentence': 'Example sentence in español',
    })
  })
  test('assigns only verncular', () => {
    // @ts-ignore
    const sentences: MultiString = { dictionary_id: 'example', text: { default: 'vernacular example sentence' } }
    expect(get_example_sentence_headers(sentences, first_sense_index)).toEqual({
      vernacular_exampleSentence: 'Example sentence in example',
    })
  })
  test('doesn\'t assign anything if null', () => {
    const sentences: MultiString = {}
    expect(get_example_sentence_headers(sentences, first_sense_index)).toEqual({})
  })
})

describe(get_image_files_headers, () => {
  test('adds photo filename and source photo', () => {
    const image_id = 'abc'
    const first_sense_index = 0
    expect(get_image_files_headers(image_id, first_sense_index)).toEqual({
      photoFile: 'Image filename',
      photoSource: 'Source of image',
    })
  })
  test('adds photo filename and source photo in second sense', () => {
    const image_id = 'abc'
    const second_sense_index = 1
    expect(get_image_files_headers(image_id, second_sense_index)).toEqual({
      's2.photoFile': 'Image filename',
      's2.photoSource': 'Source of image',
    })
  })
  test('doesn\'t assign anything if empty string', () => {
    const image_id = ''
    const first_sense_index = 0
    expect(get_image_files_headers(image_id, first_sense_index)).toEqual({})
  })
  test('doesn\'t assign anything if null', () => {
    const image_id = null
    const first_sense_index = 0
    expect(get_image_files_headers(image_id, first_sense_index)).toEqual({})
  })
})
// TODO add last test for get_sense_headers
