// import type { DeprecatedVariant } from 'kitbook'
// import type { IRegion } from '@living-dictionaries/types'
// import type Component from './GeoTaggingModal.svelte'

// export const languages = []

// const tw_region: IRegion = { coordinates: [
//   { latitude: 23.2, longitude: 121 },
//   { latitude: 24, longitude: 121.1 },
//   { latitude: 23.4, longitude: 121.5 },
//   { latitude: 23.0, longitude: 121.3 },
// ] }
// const bangladesh = { latitude: 23.2, longitude: 90 }

// export const variants: DeprecatedVariant<Component>[] = [
//   {
//     name: 'points and region',
//     props: {
//       initialCenter: bangladesh,
//       coordinates: {
//         points: [
//           { coordinates: { latitude: 23.2, longitude: 121.1 } },
//           { coordinates: { latitude: 23.6978, longitude: 120.9605 } },
//         ],
//         regions: [
//           tw_region,
//         ],
//       },
//       on_update: null,
//     },
//   },
//   {
//     name: 'region only',
//     props: {
//       initialCenter: null,
//       coordinates: {
//         regions: [
//           tw_region,
//         ],
//       },
//       on_update: null,
//     },
//   },
//   {
//     name: 'no points, initial dictionary center',
//     props: {
//       initialCenter: bangladesh,
//       coordinates: null,
//       on_update: null,
//     },
//   },
//   {
//     name: 'nothing',
//     props: {
//       initialCenter: null,
//       coordinates: null,
//       on_update: null,
//     },
//   },
// ]
