import type { Story, StoryMeta } from 'svelte-look'
import type Component from './AddSpeaker.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'speakers.add_new_speaker': 'Add new speaker',
    'speakers.name': 'Name',
    'speakers.birthplace': 'Birthplace',
    'speakers.age_range': 'Age range',
    'speakers.gender': 'Gender',
    'speakers.male': 'Male',
    'speakers.female': 'Female',
    'speakers.other': 'Other',
    'speakers.agree_to_online': 'I agree to have this recording available online',
    'misc.cancel': 'Cancel',
    'misc.save': 'Save',
  }
  return labels[key] || key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 720 }],
  page_data: {
    t,
    dbOperations: { insert_speaker: async () => ({ id: 'sp1' }) },
  },
}

export const Default: Story<typeof Component> = {
  props: { on_close: () => {}, on_speaker_added: () => {} },
}
