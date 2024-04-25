import type { DeprecatedVariant, Viewport } from 'kitbook'
import type Component from './EntryPartOfSpeech.svelte'

export const viewports: Viewport[] = [
  { width: 300, height: 50 },
]

function on_update(new_value: string[]) {
  console.info('new_value', new_value)
}

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'can edit',
    props: {
      can_edit: true,
      value: ['n', 'v'],
      on_update,
    },
    viewports: [
      { width: 400, height: 300 },
    ],
  },
  {
    name: 'cannot edit',
    props: {
      value: ['n', 'v'],
      on_update,
    },
    languages: [],
  },
  {
    name: 'undefined - can edit',
    props: {
      can_edit: true,
      value: undefined,
      on_update,
    },
    languages: [],
  },
]
