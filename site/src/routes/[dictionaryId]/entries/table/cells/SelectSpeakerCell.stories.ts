import type { Story, StoryMeta } from 'svelte-look'
import { readable } from 'svelte/store'
import type { EntryData } from '$lib/types'
import type Component from './SelectSpeakerCell.svelte'

const sources = readable([
  { id: 'src1', slug: 'hmongdictionary-us', abbreviation: null, citation: 'hmongdictionary.us' },
])

function entry_with_audio(audio: Partial<EntryData['audios'][0]>): EntryData {
  return {
    id: 'e1',
    main: { lexeme: { default: 'mbwa' } },
    senses: [],
    audios: [{ id: 'a1', storage_path: 'a.mp3', updated_at: '', source: null, ...audio }],
    updated_at: '',
  } as unknown as EntryData
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 220, height: 44 }],
  page_data: { sources },
}

export const SpeakerName: Story<typeof Component> = {
  props: { entry: entry_with_audio({ speakers: [{ id: 'sp1', name: 'Budra Raspeda' } as never] }) },
}

/** Speaker-less audio attributed to a registry source — label dimmed/italic. */
export const SourceFallback: Story<typeof Component> = {
  props: { entry: entry_with_audio({ source: 'hmongdictionary-us' }) },
}

export const Unattributed: Story<typeof Component> = {
  props: { entry: entry_with_audio({}) },
}
