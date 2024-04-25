import type { DeprecatedVariant, Viewport } from 'kitbook'
import type Component from './List.svelte'
import { basic_mock_dictionary } from '$lib/mocks/dictionaries'
import { logDbOperations } from '$lib/mocks/db'

export const viewports: Viewport[] = [
  { width: 300, height: 150 },
  { width: 800, height: 150 },
]

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'entry with audio vs entry without audio',
    props: {
      dbOperations: logDbOperations,
      entries: [
        {
          id: '1',
          lx: 'hi - I have audio',
          sfs: [
            {
              path: '',
            },
          ],
        },
        {
          id: '2',
          lx: 'hi, I am here too',
        },
      ],
      can_edit: true,
      dictionary: basic_mock_dictionary,
    },
  },
  {
    name: 'entry with big amount of data vs entry with small amount',
    props: {
      dbOperations: logDbOperations,
      entries: [
        {
          id: '1',
          lx: 'hi - I have audio',
          gl: {
            es: 'Hola, tengo audio´',
            no: 'hei, jeg har lyd',
          },
          ps: ['adj', 'v'],
          sfs: [
            {
              path: '',
            },
          ],
          sdn: ['1', '1.3', '2'],
        },
        {
          id: '2',
          lx: 'hi, I am here too',
          sfs: [
            {
              path: '',
            },
          ],
        },
      ],
      can_edit: true,
      dictionary: basic_mock_dictionary,
    },
  },
]
