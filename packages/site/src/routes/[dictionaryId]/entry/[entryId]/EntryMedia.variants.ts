import type { Variant, Viewport } from 'kitbook'
import type Component from './EntryMedia.svelte'
import { logDbOperations } from '$lib/mocks/db'

export const viewports: Viewport[] = [
  { width: 400, height: 500 },
]

export const variants: Variant<Component>[] = [
  {
    props: {
      can_edit: true,
      videoAccess: true,
      dbOperations: logDbOperations,
      entry: {},
      dictionary: null,
    },
  },
]
