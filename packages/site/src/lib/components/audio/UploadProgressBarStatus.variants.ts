// @ts-nocheck
import type { Variant, VariantMeta } from 'kitbook'
import type Component from './UploadProgressBarStatus.svelte'
import { readable } from 'svelte/store'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 400, height: 200 },
  ],
}

export const Uploading: Variant<Component> = {
  upload_status: readable({ progress: 79 }),
}

export const Success: Variant<Component> = {
  upload_status: readable({ progress: 100 }),
}

export const Error: Variant<Component> = {
  upload_status: readable({ progress: 0, error: 'No internet connection' }),
}
