// import type { DeprecatedVariant, Viewport } from 'kitbook'
// import type { SenseWithSentences } from '@living-dictionaries/types'
// import type Component from './SupaSense.svelte'
// import { logDbOperations } from '$lib/mocks/db'

// export const viewports: Viewport[] = [{ width: 400, height: 400 }]

// const defaultProps = {
//   entryId: 'entry1',
//   glossLanguages: ['en', 'fr', 'es'],
//   ...logDbOperations,
// }

// const full_sense: SenseWithSentences = {
//   id: 'sense1',
//   glosses: {
//     en: 'to be',
//     fr: 'être',
//   },
//   noun_class: '1',
//   parts_of_speech: ['n', 'v'],
//   semantic_domains: ['1.1', '2.1'],
//   write_in_semantic_domains: ['dinobots', 'autobots'],
//   definition: { en: 'I only show when I have a value' },
//   plural_form: null,
//   variant: null,
//   sentences: [
//     {
//       id: 'sentence_1234',
//       text: { default: 'Hello' },
//       translation: {
//         es: 'Hola',
//       },
//     },
//   ],
// }

// export const variants: DeprecatedVariant<Component>[] = [
//   {
//     props: {
//       ...defaultProps,
//       can_edit: true,
//       sense: full_sense,
//     },
//   },
//   {
//     name: 'empty',
//     props: {
//       ...defaultProps,
//       can_edit: true,
//       sense: {
//         id: 'sense1',
//       },
//     },
//   },
//   {
//     name: 'cannot edit, full',
//     props: {
//       ...defaultProps,
//       sense: full_sense,
//     },
//   },
//   {
//     name: 'cannot edit, not much',
//     props: {
//       ...defaultProps,
//       sense: {
//         id: 'sense1',
//         noun_class: '1',
//       },
//     },
//   },
// ]
