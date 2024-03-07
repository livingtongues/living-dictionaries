import type { Variant, Viewport } from 'kitbook'
import type Component from './Audio.svelte'

export const viewports: Viewport[] = [
  { width: 80, height: 80 },
]

export const languages = []

const entry = {
  sound_files: [
    { fb_storage_path: '' }
  ],
}

export const variants: Variant<Component>[] = [
  {
    name: 'List sound',
    props: {
      entry,
      context: 'list',
    },
  },
  {
    name: 'Table sound',
    props: {
      entry,
      context: 'table',
    },
  },
  {
    name: 'Entry sound',
    props: {
      entry,
      context: 'entry',
    },
  },
  {
    name: 'Entry sound, can edit',
    props: {
      entry,
      context: 'entry',
      canEdit: true,
    },
  },
  {
    name: 'List no sound, can edit',
    props: {
      entry: {},
      context: 'list',
      canEdit: true,
    },
  },
  {
    name: 'Table no sound, can edit',
    props: {
      entry: {},
      context: 'table',
      canEdit: true,
    },
  },
  {
    name: 'Entry no sound, can edit',
    props: {
      entry: {},
      context: 'entry',
      canEdit: true,
    },
  },
]
