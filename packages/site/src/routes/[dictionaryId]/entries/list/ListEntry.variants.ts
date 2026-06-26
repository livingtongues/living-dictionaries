// import type { Variant, VariantMeta } from 'kitbook'
// import type Component from './ListEntry.svelte'
// import { basic_mock_dictionary } from '$lib/mocks/dictionaries'
// import { complex, simple } from '$lib/mocks/entries'
// import { logDbOperations } from '$lib/mocks/db'

// export const shared_meta: VariantMeta = {
//   viewports: [
//     { width: 400, height: 100 },
//   ],
// }

// const shared = {
//   dbOperations: logDbOperations,
//   dictionary: basic_mock_dictionary,
//   can_edit: true,
// } satisfies Partial<Variant<Component>>

// export const Complex: Variant<Component> = {
//   ...shared,
//   entry: complex,
// }

// export const Video_Access: Variant<Component> = {
//   ...shared,
//   entry: simple,
//   _meta: {
//     languages: [],
//     viewports: [{ width: 400, height: 100 }],
//   },
// }

// export const Jewish_Neo_Aramaic: Variant<Component> = {
//   ...shared,
//   dictionary: {
//     id: 'jewish-neo-aramaic',
//     name: 'Jewish Neo-Aramaic',
//     glossLanguages: ['en'],
//   },
//   entry: complex,
//   _meta: {
//     description: 'This dictionary has an exception where we show example sentences in the list view.',
//   },
// }

// // const extras = [
// //   {
// //     name: 'no sound file - cannot edit',
// //     props: {
// //       entry: {
// //         'di': 'Hill',
// //         'createdBy': 'OTD',
// //         'sdn': [
// //           '10.9'
// //         ],
// //         'nt': '2011 Tikorapoda',
// //         'lx': 'a-dʒa',
// //         'gl': {
// //           'en': 'whom'
// //         },
// //         'id': 'RdaOfXwRhP7uBVDvzzBd'
// //       }
// //     },
// //   },
// //   {
// //     name: 'no sound file - can edit',
// //     props: {
// //       entry: {
// //         'di': 'Hill',
// //         'createdBy': 'OTD',
// //         'sdn': [
// //           '10.9'
// //         ],
// //         'nt': '2011 Tikorapoda',
// //         'lx': 'a-dʒa',
// //         'gl': {
// //           'en': 'whom'
// //         },
// //         'id': 'RdaOfXwRhP7uBVDvzzBd'
// //       },
// //       can_edit: true,
// //     },
// //   },
// //   {
// //     name: 'sound file',
// //     props: {
// //       entry: {
// //         'sd': null,
// //         'gl': {
// //           'en': 'fearless'
// //         },
// //         'createdBy': 'OTD',
// //         'lx': 'a-bʈiŋmajg=tǝ',
// //         'di': 'Hill',
// //         'sdn': [
// //           '3.2'
// //         ],
// //         'sf': {
// //           'source': 'local_import',
// //           ts: 1580860148537,
// //           'path': 'gta/audio/local_import/Gta-BR-Tkrpr-11-11-fearless-1580859678428.mp3',
// //           'speakerName': 'Budra Raspeda'
// //         },
// //         'nt': '2011 Tikorapoda',
// //         'id': 'yZB1c77QklFjABlfMDm1'
// //       }
// //     },
// //   },
// //   {
// //     name: 'no gloss',
// //     props: {
// //       entry: {
// //         'lx': '[n]hug-boʔ',
// //         'sf': {
// //           'source': 'local_import',
// //           ts: 1580860148537,
// //           'speakerName': 'Budra Raspeda',
// //           'path': 'gta/audio/local_import/2010-9-26-Gta-nhugbo-hair-1580862091120.mp3'
// //         },
// //         'sdn': [
// //           '2.1'
// //         ],
// //         'createdBy': 'OTD',
// //         'di': 'Hill',
// //         'gl': {
// //           'en': null
// //         },
// //         'id': 'xMnDS5aHSfemIdSpacN8'
// //       }
// //     }
// //   }
// // ]
