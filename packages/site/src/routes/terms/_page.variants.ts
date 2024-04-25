import type { DeprecatedVariant, Viewport } from 'kitbook'
import type Component from './+page.svelte'

export const viewports: Viewport[] = [{ width: 600, height: 800 }]

export const variants: DeprecatedVariant<Component>[] = [
  {
    languages: [],
    props: {},
  },
]
