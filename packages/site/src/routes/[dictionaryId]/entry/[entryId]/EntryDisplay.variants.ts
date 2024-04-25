import type { DeepPartial, DeprecatedVariant, Viewport } from 'kitbook'
import type { IDictionary } from '@living-dictionaries/types'
import type Component from './EntryDisplay.svelte'
import { logDbOperations } from '$lib/mocks/db'

export const viewports: Viewport[] = [
  {
    name: 'Desktop',
    width: 1024,
    height: 768,
  },
  {
    name: 'Mobile',
    width: 375,
    height: 667,
  },
]

const defaultDictionary: IDictionary = {
  name: 'Banange',
  glossLanguages: ['en', 'es'],
}

const defaultEntry = {
  lexeme: 'foo',
  senses: [
    {
      glosses: {},
    },
  ],
}

// const indiaBox: IRegion = {
//   'coordinates': [
//     {
//       'longitude': 76.53807812500065,
//       'latitude': 25.598062849584352
//     },
//     {
//       'longitude': 91.12792187500162,
//       'latitude': 25.598062849584352
//     },
//     {
//       'longitude': 82.60253125000094,
//       'latitude': 30.93627270844425
//     },
//     {
//       'latitude': 18.933437473181115,
//       'longitude': 83.04198437500133
//     }
//   ]
// }

const partialVariants: DeepPartial<DeprecatedVariant<Component>[]> = [
  {
    name: '2 senses',
    props: {
      can_edit: true,
      videoAccess: true,
      entry: {
        id: 'entryId123',
        lexeme: 'shoot',
        phonetic: 'ʃut',
        sound_files: [{
          fb_storage_path: 'sora/audio/local_import/2011-9-15-Sora-7-26-ZR-bolya-tree-bst-1580869801459.mp3',
          speakerName: 'Zasina Roita',
        }],
        senses: [
          {
            glosses: {
              en: 'a young branch or sucker springing from the main stock of a tree or other plant',
            },
            translated_parts_of_speech: ['noun'],
            translated_ld_semantic_domains: ['botany'],
            example_sentences: [
              {
                vn: '请把这个嫩枝剪下来放进炖菜里。',
                en: 'Please cut this shoot and put it in the stew.',
                es: 'Por favor, corta este brote y ponlo en el guiso.',
              },
            ],
          },
        ],
        local_orthography_1: 'संस्कृतम्',
        sources: ['someone'],
        coordinates: {
          // 'regions': [indiaBox],
        },
      },
      supaEntry: {
        senses: [
          {
            id: '1',
            glosses: {
              en: 'to fire a rocket',
            },
            parts_of_speech: ['v'],
            semantic_domains: ['1.1'],
          },
        ],
      },
      dictionary: {
        alternateOrthographies: [
          'Old Sanskrit',
        ],
      },
    },
    tests: {
      clientSideRendered: true,
    },
  },
  {
    name: 'Custom imported semantic domain',
    props: {
      can_edit: true,
      entry: {
        senses: [
          {
            photo_files: [{ specifiable_image_url: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g' }],
            write_in_semantic_domains: ['something-random-from-1992'],
            ld_semantic_domains_keys: ['1'],
            translated_ld_semantic_domains: ['Universe and the natural world'],
          },
        ],
      },
    },
  },
  {
    name: 'Local orthographies',
    languages: [],
    viewports: [{ width: 400, height: 300 }],
    props: {
      entry: {
        lexeme: 'Hello',
        local_orthography_1: 'special writing system',
        local_orthography_2: 'another writing system',
      },
      dictionary: {
        alternateOrthographies: [
          'foobey',
          'foobar',
        ],
      },
    },
  },
  {
    name: 'Scientific Name',
    languages: [],
    viewports: [{ width: 400, height: 200 }],
    props: {
      entry: {
        lexeme: 'Old world swallowtail',
        scientific_names: ['Papilio machaon'],
      },
    },
  },
  {
    name: 'Scientific Name - Partial italics',
    description: 'can edit',
    languages: [],
    props: {
      entry: {
        lexeme: 'Old world swallowtail',
        scientific_names: ['<i>Papilio machaon</i>, Dr. G.'],
      },
      can_edit: true,
    },
  },
  {
    name: 'No details, can edit',
    description: 'temporarily using admin is true until edit senses is no longer behind a flag',
    languages: [],
    props: {
      can_edit: true,
    },
  },
  {
    name: 'cannot edit, two additional senses',
    languages: [],
    props: {
      entry: {
        lexeme: 'apple',
        phonetic: 'æpl',
        senses: [
          { glosses: { en: 'a fruit' } },
        ],
      },
      supaEntry: {
        senses: [
          { glosses: { en: 'a company' } },
          { glosses: { en: 'a color' }, semantic_domains: ['1.6'] },
        ],
      },
    },
  },
]

export const variants: DeprecatedVariant<Component>[] = (partialVariants as DeprecatedVariant<Component>[]).map(variant => ({
  ...variant,
  props: {
    ...variant.props,
    dictionary: {
      ...defaultDictionary,
      ...variant.props?.dictionary,
    },
    entry: {
      ...defaultEntry,
      ...variant.props?.entry,
    },
    dbOperations: logDbOperations,
  },
}))
