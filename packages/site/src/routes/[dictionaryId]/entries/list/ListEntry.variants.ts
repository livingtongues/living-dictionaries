import type { Variants } from 'kitbook';
import type Component from './ListEntry.svelte';
import { basic_mock_dictionary } from '$lib/mocks/dictionaries';
import { mock_expanded_entries } from '$lib/mocks/entries';

export const variants: Variants<Component> = [...mock_expanded_entries.map(variant => {
  return {
    name: variant.name,
    height: 130,
    props: {
      dictionary: basic_mock_dictionary,
      entry: variant.entry,
      canEdit: true,
      // videoAccess,
    }
  };
}),
{
  name: 'video access',
  height: 110,
  props: {
    dictionary: basic_mock_dictionary,
    entry: mock_expanded_entries[1].entry,
    canEdit: true,
    videoAccess: true,
  }
},
{
  name: 'jewish-neo-aramaic',
  description: 'This dictionary has an exception where we show dialects and example sentences in the list view.',
  height: 190,
  props: {
    dictionary: {
      id: 'jewish-neo-aramaic',
      name: 'Jewish Neo-Aramaic',
      glossLanguages: ['en'],
    },
    entry: mock_expanded_entries[0].entry,
    canEdit: true,
    videoAccess: true,
  }
},
];

// const extras = [
//   {
//     name: 'no sound file - cannot edit',
//     props: {
//       entry: {
//         'di': 'Hill',
//         'createdBy': 'OTD',
//         'sdn': [
//           '10.9'
//         ],
//         'nt': '2011 Tikorapoda',
//         'lx': 'a-dʒa',
//         'gl': {
//           'en': 'whom'
//         },
//         'id': 'RdaOfXwRhP7uBVDvzzBd'
//       }
//     },
//   },
//   {
//     name: 'no sound file - can edit',
//     props: {
//       entry: {
//         'di': 'Hill',
//         'createdBy': 'OTD',
//         'sdn': [
//           '10.9'
//         ],
//         'nt': '2011 Tikorapoda',
//         'lx': 'a-dʒa',
//         'gl': {
//           'en': 'whom'
//         },
//         'id': 'RdaOfXwRhP7uBVDvzzBd'
//       },
//       canEdit: true,
//     },
//   },
//   {
//     name: 'sound file',
//     props: {
//       entry: {
//         'sd': null,
//         'gl': {
//           'en': 'fearless'
//         },
//         'createdBy': 'OTD',
//         'lx': 'a-bʈiŋmajg=tǝ',
//         'di': 'Hill',
//         'sdn': [
//           '3.2'
//         ],
//         'sf': {
//           'source': 'local_import',
//           ts: 1580860148537,
//           'path': 'gta/audio/local_import/Gta-BR-Tkrpr-11-11-fearless-1580859678428.mp3',
//           'speakerName': 'Budra Raspeda'
//         },
//         'nt': '2011 Tikorapoda',
//         'id': 'yZB1c77QklFjABlfMDm1'
//       }
//     },
//   },
//   {
//     name: 'no gloss',
//     props: {
//       entry: {
//         'lx': '[n]hug-boʔ',
//         'sf': {
//           'source': 'local_import',
//           ts: 1580860148537,
//           'speakerName': 'Budra Raspeda',
//           'path': 'gta/audio/local_import/2010-9-26-Gta-nhugbo-hair-1580862091120.mp3'
//         },
//         'sdn': [
//           '2.1'
//         ],
//         'createdBy': 'OTD',
//         'di': 'Hill',
//         'gl': {
//           'en': null
//         },
//         'id': 'xMnDS5aHSfemIdSpacN8'
//       }
//     }
//   }
// ]
