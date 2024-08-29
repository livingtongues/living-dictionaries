import type { DeprecatedVariant, Viewport } from 'kitbook'
import type { ExpandedEntry } from '@living-dictionaries/types'
import type Component from './Audio.svelte'
import { logDbOperations } from '$lib/mocks/db'

export const viewports: Viewport[] = [
  { width: 80, height: 80 },
]

export const languages = []

const entry: ExpandedEntry = {
  sound_files: [
    { fb_storage_path: '', storage_url: '' },
  ],
}

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'List sound',
    props: {
      entry,
      context: 'list',
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'Table sound',
    props: {
      entry,
      context: 'table',
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'Entry sound',
    props: {
      entry,
      context: 'entry',
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'Entry sound, can edit',
    props: {
      entry,
      context: 'entry',
      can_edit: true,
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'List no sound, can edit',
    props: {
      entry: {},
      context: 'list',
      can_edit: true,
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'Table no sound, can edit',
    props: {
      entry: {},
      context: 'table',
      can_edit: true,
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
  {
    name: 'Entry no sound, can edit',
    props: {
      entry: {},
      context: 'entry',
      can_edit: true,
      updateEntryOnline: logDbOperations.updateEntryOnline,
    },
  },
]
