import type { Tables } from '@living-dictionaries/types'
import { order_entry_and_dictionary_gloss_languages, order_example_sentences, order_glosses } from './glosses'
import { remove_italic_tags } from './remove_italic_tags'
import { english_translate } from '$lib/i18n'

describe(order_glosses, () => {
  const t = english_translate

  const glosses = {
    en: 'apple',
    es: 'manzana',
    scientific: '<i>Neolamarckia cadamba</i>',
    empty: '',
    null: null,
    de: 'apfel',
  }
  const dictionary_gloss_languages = ['de', 'es', 'en']

  test('orders based on dictionary_gloss_languages first', () => {
    expect(order_glosses({ glosses, dictionary_gloss_languages, t })).toEqual([
      'apfel',
      'manzana',
      'apple',
      '<i>Neolamarckia cadamba</i>',
    ])
  })

  test('adds language label when label set to true', () => {
    expect(order_glosses({ glosses, dictionary_gloss_languages, t, label: true }))
      .toEqual([
        'German: apfel',
        'Spanish: manzana',
        'English: apple',
        'scientific: <i>Neolamarckia cadamba</i>',
      ])
  })

  test('handles an empty glosses object', () => {
    expect(order_glosses({ glosses: {}, dictionary_gloss_languages, t })).toEqual([])
  })

  test('handles undefined glosses object', () => {
    expect(order_glosses({ glosses: undefined, dictionary_gloss_languages, t })).toEqual([])
  })

  test('example implementation with join and italics removal', () => {
    expect(
      remove_italic_tags(
        order_glosses({ glosses, dictionary_gloss_languages, t }).join(', '),
      ),
    ).toEqual('apfel, manzana, apple, Neolamarckia cadamba')
  })
})

describe(order_example_sentences, () => {
  const sentence: Partial<Tables<'sentences'>> = {
    text: {
      default: 'hyn du ha',
    },
    translation: {
      en: 'the apple is red',
      es: 'la manzana es roja',
      de: 'der Apfel ist rot',
    },
  }
  const dictionary_gloss_languages = ['de', 'es', 'en']

  test('orders based on vernacular first', () => {
    expect(order_example_sentences({ sentence, dictionary_gloss_languages }).join(' / ')).toEqual('hyn du ha / der Apfel ist rot / la manzana es roja / the apple is red')
  })

  test('order if some examples are empty strings, null or do not exist', () => {
    const sentence: Partial<Tables<'sentences'>> = {
      text: {
        default: 'hyn du ha',
      },
      translation: {
        en: '',
        es: null,
      },
    }
    expect(order_example_sentences({ sentence, dictionary_gloss_languages }).join(' / ')).toEqual('hyn du ha')
  })
})

describe(order_entry_and_dictionary_gloss_languages, () => {
  test('places dictionary gloss languages first, then leftovers from gloss object but does not duplicate', () => {
    expect(order_entry_and_dictionary_gloss_languages({ es: '', en: '' }, ['en', 'de']))
      .toEqual([
        'en',
        'de',
        'es',
      ])
  })
})
