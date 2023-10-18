import type { Variant } from 'kitbook';
import type Component from './EditField.svelte';
export const variants: Variant<Component>[] = [
  {
    name: 'Assamese Gloss',
    // width: 550,
    // height: 300,
    props: {
      field: 'gloss',
      bcp: 'as',
    },
  },
  {
    name: 'Normal',
    // height: 100,
    props: {
      field: 'morphology',
    },
  },
  {
    name: 'Lexeme',
    // height: 300,
    props: {
      field: 'lexeme',
    },
  },
  {
    name: 'Notes',
    // width: 550,
    // height: 300,
    props: {
      field: 'notes',
    },
  },
  {
    name: 'Phonetic',
    // width: 550,
    // height: 300,
    props: {
      field: 'phonetic',
    },
  },
]
