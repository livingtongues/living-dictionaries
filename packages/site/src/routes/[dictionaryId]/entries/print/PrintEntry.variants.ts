import type { DeprecatedVariant } from 'kitbook'
import type { IPrintFields } from '@living-dictionaries/types'
import type Component from './PrintEntry.svelte'
import { defaultPrintFields } from './printFields'
import { complex, hebrew, simple } from '$lib/mocks/entries'
import { basic_mock_dictionary } from '$lib/mocks/dictionaries'

const selectedFields: IPrintFields = {
  ...defaultPrintFields,
  semantic_domains: true,
  noun_class: true,
  interlinearization: true,
  morphology: true,
  plural_form: true,
  variant: true,
  dialects: true,
  notes: true,
  photo: true,
  speaker: true,
  sources: true,
  example_sentence: true,
}

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'Example Sentences',
    viewports: [{ width: 400, height: 200 }],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: {
        lexeme: '(h)æg-ko gag=tǝnǝ nlaʔ-pog',
        senses: [{
          example_sentences: [{
            vn: 'test',
            es: 'Esta es una oración de ejemplo',
            en: 'This is an example sentence',
          }],
        }],
      },
      showQrCode: true,
      headwordSize: 20,
      showLabels: true,
    },
  },
  {
    name: 'complex',
    viewports: [{ width: 400, height: 700 }],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: complex,
      showQrCode: true,
      headwordSize: 20,
      showLabels: true,
    },
  },
  {
    name: 'complex without labels',
    viewports: [{ width: 400, height: 700 }],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: complex,
      showQrCode: true,
      headwordSize: 20,
      showLabels: false,
    },
  },
  {
    name: 'example with Hebrew text',
    description: 'This is an example where non-hebrew characters are mixed with hebrew characters in the same line.',
    viewports: [{ width: 400, height: 100 }],
    languages: [{ name: 'english', code: 'en' }, { name: 'hebrew', code: 'he' }],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: hebrew,
      headwordSize: 20,
    },
  },
  {
    name: 'simple',
    viewports: [{ width: 400, height: 100 }],
    languages: [],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: simple,
      headwordSize: 20,
    },
  },
]
