import type { Variant, Viewport } from 'kitbook';
import type Component from './EditField.svelte';

export const viewports: Viewport[] = [{
  width: 700,
  height: 200,
}]


export const variants: Variant<Component>[] = [
  {
    name: 'Assamese Gloss',
    description: 'should have keyboard icon',
    props: {
      field: 'gloss',
      bcp: 'as',
    },
    languages: [],
  },
  {
    name: 'Italicized Gloss',
    props: {
      field: 'gloss',
      bcp: 'as',
      value: 'red <i>tomato</i>',
    },
    languages: [],
  },
  {
    name: 'Interlinear',
    description: 'has small caps toggle option (needs translation)',
    props: {
      field: 'interlinearization',
      value: '3p.sɢ.ind',
    },
  },
  {
    name: 'Morphology',
    props: {
      field: 'morphology',
    },
    languages: [],
  },
  {
    name: 'Lexeme',
    props: {
      field: 'lexeme',
      value: 'banana',
    },
    languages: [],
  },
  {
    name: 'Notes',
    props: {
      field: 'notes',
      value: 'hello',
    },
    languages: [],
    tests: {
      clientSideRendered: true, // let rich-text editor load in
    }
  },
  {
    name: 'Phonetic',
    description: 'needs translation',
    viewports: [{
      width: 750,
      height: 600,
    }],
    props: {
      field: 'phonetic',
      value: 'banana',
    },
    tests: {
      clientSideRendered: true, // so that keyboard can load in
    }
  },
]
