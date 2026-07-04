import { readable } from 'svelte/store'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AddVideo.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'audio.select_speaker': 'Select Speaker',
    'entry_field.speaker': 'Speaker',
    'misc.add': 'Add',
    'video.record': 'Record video',
    'video.select': 'Select video file',
    'video.paste_link': 'Paste video link',
  }
  return labels[key] || key
}

const entry = {
  id: 'e1',
  main: { lexeme: { default: 'tree' } },
  senses: [{ id: 's1' }],
} as any

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 640 }],
  page_data: {
    t,
    dictionary: { id: 'demo' },
    speakers: readable([{ id: 'sp1', name: 'Ana Marija' }]),
    sources: readable([]),
    dbOperations: {
      uploadVideo: () => readable({ progress: 0 }),
      insert_video: async () => ({ id: 'v1' }),
      assign_speaker: async () => {},
    },
  },
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {}, entry },
}
