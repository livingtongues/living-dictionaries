// import type { DeprecatedVariant } from 'kitbook'
// import { readable } from 'svelte/store'
// import type { ComponentProps } from 'svelte'
// import type Component from './+page.svelte'
// import { mockDictionaryLayoutData } from '$lib/mocks/layout'

// const defaultProps: ComponentProps<Component>['data'] = {
//   ...mockDictionaryLayoutData,
//   supa_entry: null,
//   entry: readable({
//     lexeme: 'test',
//   }),
//   shallow: false,
// }

// export const variants: DeprecatedVariant<Component>[] = [
//   {
//     name: 'Viewer',
//     viewports: [{ width: 500, height: 250 }],
//     props: {
//       data: {
//         ...defaultProps,
//         entry: readable({
//           lexeme: 'test',
//           senses: [{
//             glosses: {
//               en: 'foo',
//             },
//           }],
//         }),
//       },
//     },
//   },
//   {
//     name: 'Editor',
//     viewports: [{ width: 786, height: 500 }],
//     props: {
//       data: {
//         ...defaultProps,
//         is_manager: readable(true),
//         can_edit: readable(true),
//       },
//     },
//   },
//   {
//     name: 'Admin 2',
//     description: 'Will show JSON viewer and Add Sense (as it is in beta)',
//     languages: [],
//     viewports: [{ width: 786, height: 500 }],
//     props: {
//       data: {
//         ...defaultProps,
//         admin: readable(2),
//         can_edit: readable(true),
//       },
//     },
//     tests: {
//       skip: true,
//     },
//   },
// ]
