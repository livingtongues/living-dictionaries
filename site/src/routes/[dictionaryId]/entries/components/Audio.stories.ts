import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Audio.svelte'
import type { EntryData } from '$lib/types'
import { mock_t } from '$lib/mocks/mock-t'

// Entry-detail tile (EntryMedia gives it surface bg + 5rem height via `.entry-audio-tile`;
// stories verify the content: ear + bold speaker name + muted Listen caption).

export const shared_meta: StoryMeta = {
  viewports: [{ width: 220, height: 110 }],
  page_data: { t: mock_t, locale: 'en' },
}

const entry = {
  id: 'e1',
  updated_at: '2026-01-01T00:00:00Z',
  main: { lexeme: { default: 'adiʔol' } },
  senses: [{ id: 's1', glosses: { en: 'cotton leaves' } }],
} as unknown as EntryData

const sound_file = { id: 'a1', storage_path: 'demo/audio/a1.mp3', updated_at: '2026-01-01T00:00:00Z', speakers: [{ name: 'Rosa Lopez' }] } as unknown as NonNullable<EntryData['audios']>[0]

export const VisitorTileWithSpeaker: Story<typeof Component> = {
  props: { entry, context: 'entry', sound_file, speaker_label: { id: 'a1', storage_path: 'demo/audio/a1.mp3', label: 'Rosa Lopez', ordinal: null, no_speaker: false } },
}

/** Duplicate-name tile — quiet ordinal after the bold name. */
export const TileDuplicateNameOrdinal: Story<typeof Component> = {
  props: { entry, context: 'entry', sound_file, speaker_label: { id: 'a1', storage_path: 'demo/audio/a1.mp3', label: 'Sam Brown', ordinal: '2', no_speaker: false } },
}

/** Speakerless recording — bare position number, italic/muted. */
export const TileNoSpeaker: Story<typeof Component> = {
  props: { entry, context: 'entry', sound_file, speaker_label: { id: 'a1', storage_path: 'demo/audio/a1.mp3', label: '3', ordinal: null, no_speaker: true } },
}

/** Editor tile keeps the Listen + Edit Audio caption under the name. */
export const EditorTileWithSpeaker: Story<typeof Component> = {
  props: { entry, context: 'entry', sound_file, can_edit: true, speaker_label: { id: 'a1', storage_path: 'demo/audio/a1.mp3', label: 'Rosa Lopez', ordinal: null, no_speaker: false } },
}
