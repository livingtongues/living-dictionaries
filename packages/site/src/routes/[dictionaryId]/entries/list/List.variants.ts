import type { Variant, Viewport } from 'kitbook'
import type Component from './List.svelte'
import { basic_mock_dictionary } from '$lib/mocks/dictionaries'

export const viewports: Viewport[] = [
  { width: 300, height: 150 },
  { width: 800, height: 150 },
]

export const variants: Variant<Component>[] = [
  {
    props: {
      entries: [
        {
          id: '1',
          lx: 'hi - I have audio',
          sfs: [
            {
              path: ''
            }
          ]
        },
        {
          id: '2',
          lx: 'hi, I am here too',
        },
      ],
      canEdit: true,
      dictionary: basic_mock_dictionary
    },
  },
]
