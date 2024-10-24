// import type { DeprecatedVariant, Viewport } from 'kitbook'
// import { writable } from 'svelte/store'
// import type { QueryParamStore } from 'svelte-pieces'
// import type Component from './FilterList.svelte'
// import type { QueryParams } from '$lib/search/types'

// export const viewports: Viewport[] = [
//   { width: 200, height: 500 },
// ]

// export const variants: DeprecatedVariant<Component>[] = [
//   // TODO: no search params variant
//   {
//     name: 'Few',
//     viewports: [
//       { width: 200, height: 100 },
//     ],
//     props: {
//       label: 'Dialect',
//       search_params: writable({ dialects: ['north'] }) as QueryParamStore<QueryParams>,
//       search_param_key: 'dialects',
//       values: {
//         west: 2,
//         east: 1,
//         north: 10,
//       },
//     },
//   },
//   {
//     name: 'Many',
//     props: {
//       label: 'Dialect',
//       search_params: writable({ dialects: ['north'] }) as QueryParamStore<QueryParams>,
//       search_param_key: 'dialects',
//       values: {
//         'west': 2,
//         'east': 1,
//         'north': 10,
//         'south': 5,
//         'central': 3,
//         'north west': 2,
//         'north east': 1,
//         'south east': 10,
//         'south west': 5,
//         'central west': 3,
//         'central east': 2,
//         'northwest west': 1,
//         'northeast west': 10,
//       },
//     },
//   },
//   {
//     name: 'Speaker Ids mapped to speaker names',
//     description: 'Can search for Brim even though does not exist in the list of values.',
//     viewports: [
//       { width: 200, height: 200 },
//     ],
//     props: {
//       label: 'Speaker',
//       search_params: writable({ speakers: ['1'] }) as QueryParamStore<QueryParams>,
//       search_param_key: 'speakers',
//       values: {
//         '1234-------------------------1234': 2,
//         'Bob_Smith': 1,
//         'John_Boot': 10,
//         'John_Lee': 5,
//         'John_Lewis': 3,
//         'John_Littlejohn': 2,
//       },
//       speaker_ids_to_names: {
//         '1234-------------------------1234': 'John Brim',
//       },
//     },
//   },
// ]
