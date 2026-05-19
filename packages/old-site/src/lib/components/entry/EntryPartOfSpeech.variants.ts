// @ts-nocheck
import type { Variant, VariantMeta } from 'kitbook'
import type Component from './EntryPartOfSpeech.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 300, height: 50 },
  ],
}

const shared = {
  on_update: new_value => console.info('new_value', new_value),
} satisfies Partial<Variant<Component>>

export const Can_Edit: Variant<Component> = {
  ...shared,
  can_edit: true,
  value: ['n', 'v'],
  _meta: {
    viewports: [
      { width: 400, height: 300 },
    ],
  },
}

export const Cannot_Edit: Variant<Component> = {
  ...shared,
  value: ['n', 'v'],
  _meta: {
    languages: [],

  },
}

export const Undefined_Can_Edit: Variant<Component> = {
  ...shared,
  can_edit: true,
  value: undefined,
  _meta: {
    languages: [],

  },
}
