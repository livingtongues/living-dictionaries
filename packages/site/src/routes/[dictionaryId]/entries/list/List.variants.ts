import type { Variant, Viewport } from 'kitbook'
import type Component from './List.svelte'
import { basic_mock_dictionary } from '$lib/mocks/dictionaries'

export const viewports: Viewport[] = [
  { width: 300, height: 150 },
  { width: 800, height: 150 },
]

export const variants: Variant<Component>[] = [
  {
    name: 'entry with audio vs entry without audio',
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
  {
    name: 'entry with small amount of data vs entry with a big amount',
    props: {
      entries: [
        {
          id: '1',
          lx: 'hi - I have audio',
          gl: {
            es: 'Hola, tengo audio´',
            no: 'hei, jeg har lyd'
          },
          ps: ['adj', 'v'],
          sfs: [
            {
              path: ''
            }
          ],
          sdn: ['1', '1.3', '2']
        },
        {
          id: '2',
          lx: 'hi, I am here too',
          sfs: [
            {
              path: ''
            }
          ],
        },
      ],
      canEdit: true,
      dictionary: basic_mock_dictionary
    },
  },
]
