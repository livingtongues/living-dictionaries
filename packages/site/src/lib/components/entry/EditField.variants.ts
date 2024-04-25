import type { Variant, VariantMeta } from 'kitbook'
import type Component from './EditField.svelte'

export const shared_meta: VariantMeta = {
  viewports: [{ width: 700, height: 200 }],
}

const shared = {
  on_update: (new_value: string) => console.info('new_value', new_value),
  on_close: null,
} satisfies Partial<Variant<Component>>

export const Assamese_Gloss: Variant<Component> = {
  ...shared,
  field: 'gloss',
  bcp: 'as',
  _meta: {
    description: 'should have keyboard icon',
    languages: [],
  },
}

export const Italicized_Gloss: Variant<Component> = {
  ...shared,
  field: 'gloss',
  bcp: 'as',
  value: 'red <i>tomato</i>',
  _meta: {
    languages: [],
  },
}

export const Interlinear: Variant<Component> = {
  ...shared,
  field: 'interlinearization',
  value: '3p.sɢ.ind',
}

export const Morphology: Variant<Component> = {
  ...shared,
  field: 'morphology',
}

export const Lexeme: Variant<Component> = {
  ...shared,
  field: 'lexeme',
  value: 'banana',
  _meta: {
    languages: [],
  },
}

export const Notes: Variant<Component> = {
  ...shared,
  field: 'notes',
  value: 'hello',
  _meta: {
    languages: [],
    tests: {
      clientSideRendered: true, // let rich-text editor load in
    },
  },
}

export const Phonetic: Variant<Component> = {
  ...shared,
  field: 'phonetic',
  value: 'banana',
  _meta: {
    viewports: [{ width: 750, height: 600 }],
    description: 'needs translation, needs modal width to max-width of 60rem',
    tests: {
      clientSideRendered: true, // so that keyboard can load in
    },
  },
}
