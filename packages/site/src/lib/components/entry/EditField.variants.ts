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
  },
  {
    name: 'Italicized Gloss',
    props: {
      field: 'gloss',
      bcp: 'as',
      value: 'red <i>tomato</i>',
    },
  },
  { name: 'Interlinear',
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
  },
  {
    name: 'Lexeme',
    props: {
      field: 'lexeme',
      value: 'banana',
    },
  },
  {
    name: 'Notes',
    props: {
      field: 'notes',
      value: 'hello',
    },
  },
  {
    name: 'Phonetic',
    viewports: [{
      width: 750,
      height: 600,
    }],
    props: {
      field: 'phonetic',
      value: 'banana',
    },
  },
]
