// import type { Variant } from 'kitbook'
// import type { IPrintFields } from '@living-dictionaries/types'
// import type Component from './PrintEntry.svelte'
// import { defaultPrintFields } from './printFields'
// import { complex, hebrew, simple } from '$lib/mocks/entries'
// import { basic_mock_dictionary } from '$lib/mocks/dictionaries'

// const selectedFields: IPrintFields = {
//   ...defaultPrintFields,
//   semantic_domains: true,
//   noun_class: true,
//   interlinearization: true,
//   morphology: true,
//   plural_form: true,
//   variant: true,
//   dialects: true,
//   notes: true,
//   photo: true,
//   speaker: true,
//   sources: true,
//   example_sentence: true,
// }

// export const Example_Sentences: Variant<Component> = {
//   dictionary: basic_mock_dictionary,
//   selectedFields,
//   entry: {
//     lexeme: '(h)æg-ko gag=tǝnǝ nlaʔ-pog',
//     senses: [{
//       example_sentences: [{
//         vn: 'test',
//         es: 'Esta es una oración de ejemplo',
//         en: 'This is an example sentence',
//       }],
//     }],
//   },
//   headwordSize: 20,
//   _meta: {
//     viewports: [{ width: 400, height: 200 }],
//   },
// }

// export const Complex: Variant<Component> = {
//   dictionary: basic_mock_dictionary,
//   selectedFields,
//   entry: complex,
//   showQrCode: true,
//   headwordSize: 20,
//   showLabels: true,
//   _meta: {
//     viewports: [{ width: 400, height: 700 }],
//   },
// }

// export const Complex_Without_Labels: Variant<Component> = {
//   dictionary: basic_mock_dictionary,
//   selectedFields,
//   entry: complex,
//   showQrCode: true,
//   headwordSize: 20,
//   showLabels: false,
//   _meta: {
//     viewports: [{ width: 400, height: 700 }],
//   },
// }

// export const Example_With_Hebrew_Text: Variant<Component> = {
//   dictionary: basic_mock_dictionary,
//   selectedFields,
//   entry: hebrew,
//   headwordSize: 20,
//   _meta: {
//     description: 'This is an example where non-hebrew characters are mixed with hebrew characters in the same line.',
//     viewports: [{ width: 400, height: 100 }],
//     languages: [{ name: 'english', code: 'en' }, { name: 'hebrew', code: 'he' }],
//   },
// }

// export const Simple: Variant<Component> = {
//   dictionary: basic_mock_dictionary,
//   selectedFields,
//   entry: simple,
//   headwordSize: 20,
//   _meta: {
//     viewports: [{ width: 400, height: 100 }],
//   },
// }
