import type { DeprecatedVariant, Viewport } from 'kitbook'
import { readable } from 'svelte/store'
import type Component from './UploadAudioStatus.svelte'

export const viewports: Viewport[] = [
  { width: 400, height: 200 },
]

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'Uploading',
    props: {
      upload_status: readable({ progress: 79 }),
    },
  },
  {
    name: 'Success',
    props: {
      upload_status: readable({ progress: 100 }),
    },
  },
  {
    name: 'Error',
    props: {
      upload_status: readable({ progress: 0, error: 'No internet connection' }),
    },
  },
]
