import type { DeprecatedVariant, Viewport } from 'kitbook'
import type Component from './UploadImageStatus.svelte'

export const viewports: Viewport[] = [
  { width: 400, height: 200 },
]

export const variants: DeprecatedVariant<Component>[] = [
  // {
  //   name: 'Uploading',
  //   props: {
  //     upload_status: readable({ progress: 79, preview_url: 'https://fakeimg.pl/400x200/' }),
  //   },
  // },
  // {
  //   name: 'Success',
  //   props: {
  //     upload_status: readable({ progress: 100, preview_url: 'https://fakeimg.pl/400x200/', serving_url: 'https://fakeimg.pl/400x200/' }),
  //   },
  // },
  // {
  //   name: 'Error',
  //   props: {
  //     upload_status: readable({ progress: 0, error: 'No internet connection', preview_url: 'https://fakeimg.pl/400x200/' }),
  //   },
  // },
]
