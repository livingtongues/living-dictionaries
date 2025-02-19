// import type { Variant, VariantMeta } from 'kitbook'
// import { readable } from 'svelte/store'
// import type Component from './+page.svelte'
// import { mockDictionaryLayoutData } from '$lib/mocks/layout'

// export const shared_meta: VariantMeta = {
//   viewports: [
//     { width: 400, height: 200 },
//   ],
//   languages: [],
// }

// export const View: Variant<Component> = {
//   data: {
//     ...mockDictionaryLayoutData,
//     about: 'This language has interesting verb morphology...',
//     update_about: null,
//   },
// }

// export const Edit: Variant<Component> = {
//   data: {
//     ...mockDictionaryLayoutData,
//     is_manager: readable(true),
//     about: '<p>Try editing</p>',
//     update_about: null,
//   },
// }

// export const Responsive: Variant<Component> = {
//   data: {
//     ...mockDictionaryLayoutData,
//     is_manager: readable(true),
//     about: '<p>Try editing</p>',
//     update_about: null,
//   },
//   _meta: {
//     viewports: [{ width: 700, height: 600 }, { width: 300, height: 600 }],
//     description: 'Please try to edit and see how guidance text look',
//   },
// }
