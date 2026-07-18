import type { Story, StoryMeta } from 'svelte-look'
import type Component from './KaraokeSentence.svelte'
import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
import { build_text_timings } from '$lib/media/media-timings'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 340, height: 70 }],
}

const sentence = {
  id: 's1',
  text: { default: '我跟我的同学' },
  tokens: {
    default: [
      { form: '我', start: 0, end: 1 },
      { form: '跟', start: 1, end: 2 },
      { form: '我', start: 2, end: 3 },
      { form: '的', start: 3, end: 4 },
      { form: '同学', start: 4, end: 6 },
    ],
  },
} as unknown as DictRowType<'sentences'>

const timing = build_text_timings({
  ordered_sentence_ids: ['s1'],
  timings: { s1: '0,300|0,200|0,200|0,150|0,400' },
}).get('s1')

// Plain text — no timing available (untokenized / no audio).
export const PlainText: Story<typeof Component> = {
  props: {
    sentence,
    fallback_text: '我跟我的同学',
  },
}

// Karaoke highlight on the 3rd token (500–700ms span) at current_ms = 600.
export const Highlighting: Story<typeof Component> = {
  props: {
    sentence,
    timing,
    fallback_text: '我跟我的同学',
    current_ms: 600,
    is_active: true,
  },
}

// Timed but not the active sentence — tokens render with no highlight.
export const InactiveTimed: Story<typeof Component> = {
  props: {
    sentence,
    timing,
    fallback_text: '我跟我的同学',
    current_ms: 600,
    is_active: false,
  },
}
