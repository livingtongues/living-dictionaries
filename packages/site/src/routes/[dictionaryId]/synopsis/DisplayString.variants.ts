import type { Variant, VariantMeta } from 'kitbook'
import type Component from './DisplayString.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 300, height: 80 },
  ],
}

const shared = {
  display: 'Title Field',
} satisfies Partial<Variant<Component>>

export const Simple: Variant<Component> = {
  ...shared,
  value: 'first value',
}

export const Simple_Array: Variant<Component> = {
  ...shared,
  value: ['first value', 'second value', 'third value'],
}

export const Empty_Value: Variant<Component> = {
  ...shared,
  value: '',
}

export const Empty_Array: Variant<Component> = {
  ...shared,
  value: [],
}
