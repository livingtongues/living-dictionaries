import type { DeprecatedVariant, Viewport } from 'kitbook'
import { writable } from 'svelte/store'
import type Component from './Partners.svelte'
import type { ImageUploadStatus } from '$lib/components/image/upload-image'

export const viewports: Viewport[] = [
  { width: 600, height: 500 },
]

export const languages = []

function delay<T>(value: T, delay_ms = 500): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), delay_ms))
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const edits = {
  add_partner_name: (name: string) => delay(alert(name)),
  add_partner_image: (partner_id: string, file: File) => {
    const preview_url = URL.createObjectURL(file)
    const { set, subscribe } = writable<ImageUploadStatus>({ progress: 0, preview_url })
    const raise_progresss = async () => {
      for (let progress = 0; progress <= 100; progress += 5) {
        set({ progress, preview_url })
        await sleep(100)
      }
      set({ progress: 100, preview_url, serving_url: 'Q5HP9NJBQah0o0pbGXC3oTbW_oD58-ftIm1wTr0LPMDM7clCLhOzXKgPjj8Iy9LDdXlNJ2na09WDtCKo0ieUm63JVr3Whu13-w' })
    }
    raise_progresss()
    return { subscribe }
    // return readable({ progress: 79, preview_url })
  },
  delete_partner: (id: string) => delay(alert(`Deleted ${id}`)),
  delete_partner_image: ({ partner_id, fb_storage_path }: { partner_id: string, fb_storage_path: string }) => delay(alert(`Deleted ${partner_id} ${fb_storage_path}`)),
  hide_living_tongues_logo: (hide: boolean) => delay(alert(`Hidden: ${hide}`)),
}

const partners = [
  {
    name: 'School of Linguistics',
    id: '1',
  },
  {
    name: 'Standard Linguistics House',
    logo: {
      fb_storage_path: 'fake/path',
      specifiable_image_url: 'Q5HP9NJBQah0o0pbGXC3oTbW_oD58-ftIm1wTr0LPMDM7clCLhOzXKgPjj8Iy9LDdXlNJ2na09WDtCKo0ieUm63JVr3Whu13-w',
    },
    id: '2',
  },
]

export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'only admin',
    props: {
      admin: 1,
      can_edit: true,
      partners,
      ...edits,
    },
  },
  {
    name: 'only admin without Living Tongues logo',
    props: {
      hideLivingTonguesLogo: true,
      admin: 1,
      can_edit: true,
      partners,
      ...edits,
    },
  },
  {
    name: 'can edit',
    props: {
      can_edit: true,
      partners,
      ...edits,
    },
  },
  {
    name: 'viewer',
    props: {
      partners,
      ...edits,
    },
  },
  {
    name: 'viewer without Living Tongues logo',
    props: {
      hideLivingTonguesLogo: true,
      partners,
      ...edits,
    },
  },
]
