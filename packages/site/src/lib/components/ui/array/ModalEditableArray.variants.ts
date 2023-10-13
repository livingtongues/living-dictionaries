import type { Variants } from 'kitbook';
import type Component from './ModalEditableArray.svelte';
export const variants: Variants<Component> = [
  {
    // height: 450,
    // width: 700,
    props: {
      values: ['1.2'],
      placeholder: 'Select...',
      options: [
        { value: '1.2', name: 'sky' },
        { value: '1.3', name: 'water' },
      ],
    }
  },
  {
    name: 'can edit',
    // height: 450,
    // width: 700,
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
    }
  },
  {
    name: 'can write-in',
    // height: 450,
    // width: 700,
    props: {
      values: [],
      placeholder: 'Select elements',
      options: [],
      canEdit: true,
      canWriteIn: true,
    }
  },
]
