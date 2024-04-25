import type { DeprecatedVariant, Viewport } from 'kitbook'
import { readable } from 'svelte/store'
import type Component from './AddImage.svelte'

export const viewports: Viewport[] = [
  { width: 400, height: 200 },
]

export const variants: DeprecatedVariant<Component>[] = [
  {
    props: {
      upload_image: (file: File) => {
        console.info('Uploading image', file)
        return readable({ progress: 25, preview_url: URL.createObjectURL(file) })
      },
    },
  },
]
