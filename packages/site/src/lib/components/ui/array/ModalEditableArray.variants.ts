import type { Variant, Viewport } from 'kitbook';
import type Component from './ModalEditableArray.svelte';

export const viewports: Viewport[] = [
  { width: 400, height: 600}
]

export const languages = []

const on_update = (new_value) => {
  console.info('new_value', new_value)
}

export const variants: Variant<Component>[] = [
  {
    name: 'cannot edit',
    viewports: [
      { width: 300, height: 50}
    ],
    props: {
      values: ['1.2'],
      placeholder: 'Select...',
      options: [
        { value: '1.2', name: 'sky' },
        { value: '1.3', name: 'water' },
      ],
      on_update,
    }
  },
  {
    name: 'can edit',
    props: {
      values: ['1.2', '1.3'],
      placeholder: 'Select elements',
      options: [
        { value: '1.2', name: 'sky' },
        { value: '1.3', name: 'water' },
        { value: '1.4', name: 'wind' },
        { value: '1.5', name: 'fire' },
      ],
      canEdit: true,
      on_update,
    }
  },
  {
    name: 'can write-in',
    props: {
      values: [],
      placeholder: 'Select elements',
      options: [],
      canEdit: true,
      canWriteIn: true,
      on_update,
    }
  },
]
