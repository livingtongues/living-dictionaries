import type { Variant, Viewport } from 'kitbook';
import type Component from './EntryDisplay.svelte';
import type { IDictionary } from '@living-dictionaries/types';
import { Timestamp } from 'firebase/firestore';

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
  }
]

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const defaultDictionary: IDictionary = {
  name: 'Banange',
  glossLanguages: ['en', 'es'],
};

const defaultEntry = {
  lexeme: 'foo',
  senses: [
    {
      glosses: {},
    }
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

const partialVariants: DeepPartial<Variant<Component>[]> = [
  {
    name: '2 senses',
    props: {
      canEdit: true,
      videoAccess: true,
      entry: {
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
              }
            ]
          },
          {
            glosses: {
              en: 'to hit, wound, damage, kill, or destroy with a missile discharged from a weapon',
            },
            translated_parts_of_speech: ['verb'],
            translated_ld_semantic_domains: ['warfare'],
          },
        ],
        local_orthography_1: 'संस्कृतम्',
        sources: ['someone'],
        coordinates: {
          // 'regions': [indiaBox],
        }
      },
      dictionary: {
        alternateOrthographies: [
          'Old Sanskrit',
        ]
      },
    },
    tests: {
      clientSideRendered: true,
    }
  },
  {
    name: 'Custom imported semantic domain',
    props: {
      canEdit: true,
      entry: {
        senses: [
          {
            photo_files: [{ specifiable_image_url: 'LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g'}],
            write_in_semantic_domains: ['something-random-from-1992'],
            ld_semantic_domains_keys: ['1'],
            translated_ld_semantic_domains: ['Universe and the natural world']
          }
        ],
      },
    }
  },
  {
    name: 'Local orthographies',
    languages: [],
    viewports: [{width: 400, height: 300}],
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
        ]
      },
    },
  },
  {
    name: 'Scientific Name',
    languages: [],
    viewports: [{width: 400, height: 200}],
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
      canEdit: true,
    },
  },
  {
    name: 'History',
    description: 'Entry with history',
    languages: [],
    props: {
      history: [
        {
          editor: 'Anna Luisa',
          editedLexeme: 'Giraffe',
          entryId: 'EntryDisplay',
          editedDictionaryId: 'Banange',
          action: 'edited',
          updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 15, 59, 2))
        },
        {
          editor: 'Diego Córdova',
          editedLexeme: 'Giraffe',
          entryId: 'EntryDisplay',
          editedDictionaryId: 'Banange',
          action: 'edited',
          updatedAt: Timestamp.fromDate(new Date(2023, 9, 12, 15, 35, 59))
        },
        {
          editor: 'Anna Luisa',
          editedLexeme: 'Snake',
          entryId: '002',
          editedDictionaryId: 'Banange',
          action: 'created',
          updatedAt: Timestamp.fromDate(new Date(2023, 8, 24, 15, 36, 54))
        },
        {
          editor: 'Diego Córdova',
          editedLexeme: 'Giraffe',
          entryId: 'EntryDisplay',
          editedDictionaryId: 'Banange',
          action: 'created',
          updatedAt: Timestamp.fromDate(new Date(2023, 7, 11, 15, 35, 54))
        },
      ],
      entry: {
        lexeme: 'Giraffe',
      },
      canEdit: true,
    },
  },
  {
    name: 'No details, can edit',
    languages: [],
    props: {
      canEdit: true,
    },
  },
];

export const variants: Variant<Component>[] = (partialVariants as Variant<Component>[]).map((variant) => ({
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
  },
}));
