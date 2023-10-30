import type { Variant } from 'kitbook'
import type Component from './Sense.svelte'

// export const viewports: Viewport[] = [
//   { name: 'Desktop', width: 800, height: 600 },
//   { name: 'Mobile', width: 320, height: 480}
// ]

export const variants: Variant<Component>[] = [
  {
    props: {
      sense: {
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
      canEdit: true,
      glossLanguages: ['en', 'es'],
    },

  },
]
