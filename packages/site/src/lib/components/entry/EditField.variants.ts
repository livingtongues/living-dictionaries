import type { Variant, Viewport } from 'kitbook';
import type Component from './EditField.svelte';

export const viewports: Viewport[] = [{
  width: 700,
  height: 200,
}]

const on_update = (new_value: string) => {
  console.info('new_value', new_value)
}

export const variants: Variant<Component>[] = [
  {
    name: 'Assamese Gloss',
    description: 'should have keyboard icon',
    props: {
      field: 'gloss',
      bcp: 'as',
      on_update,
      on_close: null,
    },
    languages: [],
  },
  {
    name: 'Italicized Gloss',
    props: {
      field: 'gloss',
      bcp: 'as',
      value: 'red <i>tomato</i>',
      on_update,
      on_close: null,
    },
    languages: [],
  },
  {
    name: 'Interlinear',
    description: 'has small caps toggle option (needs translation)',
    props: {
      field: 'interlinearization',
      value: '3p.sɢ.ind',
      on_update,
      on_close: null,
    },
  },
  {
    name: 'Morphology',
    props: {
      field: 'morphology',
      on_update,
      on_close: null,
    },
    languages: [],
  },
  {
    name: 'Lexeme',
    props: {
      field: 'lexeme',
      value: 'banana',
      on_update,
      on_close: null,
    },
    languages: [],
  },
  {
    name: 'Notes',
    props: {
      field: 'notes',
      value: 'hello',
      on_update,
      on_close: null,
    },
    languages: [],
    tests: {
      clientSideRendered: true, // let rich-text editor load in
    }
  },
  {
    name: 'Phonetic',
    description: 'needs translation, needs modal width to max-width of 60rem',
    viewports: [{
      width: 750,
      height: 600,
    }],
    props: {
      field: 'phonetic',
      value: 'banana',
      on_update,
      on_close: null,
    },
    tests: {
      clientSideRendered: true, // so that keyboard can load in
    }
  },
]
