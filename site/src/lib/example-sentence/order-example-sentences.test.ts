import type { Tables } from '$lib/types'
import { order_example_sentences } from './order-example-sentences'

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
