import type { Variants } from 'kitbook';
import type Component from './EditField.svelte';
export const variants: Variants<typeof Component> = [
  {
    name: 'Assamese Gloss',
    width: 550,
    height: 300,
    props: {
      field: 'gl.as'
    },
  },
  {
    name: 'Normal',
    height: 100,
    props: {
      field: 'mr'
    },
  },
  {
    name: 'Lexeme',
    height: 300,
    props: {
      field: 'lx'
    },
  },
  {
    name: 'Notes',
    width: 550,
    height: 300,
    props: {
      field: 'nt'
    },
  },
  {
    name: 'Phonetic',
    width: 550,
    height: 300,
    props: {
      field: 'ph'
    },
  },
]