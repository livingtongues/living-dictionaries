import type { Variants } from 'kitbook';
import type Component from './EntryDisplay.svelte';
import type { IDictionary } from '@living-dictionaries/types';

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

const partialVariants: DeepPartial<Variants<Component>> = [
  {
    name: 'Everything',
    height: 800,
    props: {
      canEdit: true,
      videoAccess: true,
      entry: {
        lexeme: 'shoot',
        phonetic: 'ʃut',
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
        local_orthography_1: 'special writing system',
        sources: ['someone'],
      },
      dictionary: {
        alternateOrthographies: [
          'foobey',
        ]
      },
    },
  },
  {
    name: 'Custom imported semantic domain',
    props: {
      canEdit: true,
      entry: {
        senses: [
          {
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
    height: 250,
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
    props: {
      entry: {
        lexeme: 'Old world swallowtail',
        scientific_names: ['Papilio machaon'],
      },
    },
  },
  {
    name: 'Scientific Name',
    description: 'Partial italics, can edit',
    props: {
      entry: {
        lexeme: 'Old world swallowtail',
        scientific_names: ['<i>Papilio machaon</i>, Dr. G.'],
      },
      canEdit: true,
    },
  },
  {
    name: 'No details, can edit',
    height: 600,
    props: {
      canEdit: true,
    },
  },
];

export const variants: Variants<Component> = (partialVariants as Variants<Component>).map((variant) => ({
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
