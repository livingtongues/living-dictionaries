import type { Story, StoryMeta } from 'svelte-look'
import type Component from './TextAudioPlayer.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 440, height: 90 }],
  page_data: { t: ((key: string) => key.split('.').pop()) as never },
}

export const WithSpeaker: Story<typeof Component> = {
  props: {
    audio_url: '/dev-placeholder-audio.mp3',
    speakers: [{ name: '郭钦泰安', decade: 1990 }],
    current_ms: 4200,
  },
}

export const NoSpeaker: Story<typeof Component> = {
  props: {
    audio_url: '/dev-placeholder-audio.mp3',
    current_ms: 0,
  },
}
