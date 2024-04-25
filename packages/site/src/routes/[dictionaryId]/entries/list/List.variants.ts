import type { Variant, VariantMeta } from 'kitbook'
import type Component from './List.svelte'
import { basic_mock_dictionary } from '$lib/mocks/dictionaries'
import { logDbOperations } from '$lib/mocks/db'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 300, height: 150 },
    { width: 800, height: 150 },
  ],
}

const shared = {
  dbOperations: logDbOperations,
  can_edit: true,
  dictionary: basic_mock_dictionary,
} satisfies Partial<Variant<Component>>

export const Entry_With_Audio_Vs_Entry_Without_Audio: Variant<Component> = {
  ...shared,
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

}

export const Entry_With_Big_Amount_Of_Data_Vs_Entry_With_Small_Amount: Variant<Component> = {
  ...shared,
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
}
