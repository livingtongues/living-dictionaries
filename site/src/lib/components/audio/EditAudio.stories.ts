import { readable } from 'svelte/store'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditAudio.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'audio.select_speaker': 'Select Speaker',
    'entry_field.speaker': 'Speaker',
    'misc.add': 'Add',
    'audio.tap_to_record': 'Tap to record',
    'audio.select_audio_file': 'Select audio file',
  }
  return labels[key] || key
}

const entry = {
  id: 'e1',
  main: { lexeme: { default: 'tree' } },
  senses: [{ id: 's1' }],
  audios: [],
} as any

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 640 }],
  page_data: {
    t,
    dictionary: { id: 'demo' },
    auth_user: { user: null, is_admin: false },
    url_from_storage_path: (path: string) => `/api/dev-media/${path}`,
    speakers: readable([{ id: 'sp1', name: 'Ana Marija' }]),
    sources: readable([]),
    dbOperations: {
      addAudio: () => readable({ progress: 0 }),
      assign_speaker: async () => {},
    },
  },
}

export const NewRecording: Story<typeof Component> = {
  props: { on_close: () => {}, entry, sound_file: undefined },
}
