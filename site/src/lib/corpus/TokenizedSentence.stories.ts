import type { Story, StoryMeta } from 'svelte-look'
import type Component from './TokenizedSentence.svelte'
import type { SentenceTokens } from '$lib/db/schemas/dictionary.types'
import { build_text_timings } from '$lib/media/media-timings'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 80 }],
}

// One of each match state: auto (nak), confirmed (toré), ambiguous (kaq),
// unmatched (wia), human-ignored (uh) + punctuation.
const review_tokens: SentenceTokens = {
  default: [
    { form: 'Nak', start: 0, end: 3, entry_id: 'e1', status: 'auto' },
    { form: 'toré', start: 4, end: 8, entry_id: 'e2', sense_id: 's2', status: 'confirmed' },
    { form: 'kaq', start: 9, end: 12, candidates: ['e3', 'e4'] },
    { form: 'wia', start: 13, end: 16 },
    { form: 'uh', start: 17, end: 19, status: 'ignored' },
    { form: '!', start: 19, end: 20, status: 'ignored' },
  ],
}
const review_text = 'Nak toré kaq wia uh!'

// Editor in review mode: unmatched amber, ambiguous violet, ignored struck.
export const ReviewMode: Story<typeof Component> = {
  props: {
    tokens: review_tokens,
    orthography: 'default',
    text: review_text,
    can_edit: true,
    review_mode: true,
    on_token_tap: () => {},
  },
}

// Same sentence for a plain visitor: linked words underlined, no highlights.
export const ViewerMode: Story<typeof Component> = {
  props: {
    tokens: review_tokens,
    orthography: 'default',
    text: review_text,
    on_token_tap: () => {},
  },
}

// No tokens yet — plain text fallback.
export const Untokenized: Story<typeof Component> = {
  props: {
    tokens: null,
    orthography: 'default',
    text: review_text,
  },
}

const karaoke_tokens: SentenceTokens = {
  default: [
    { form: '我', start: 0, end: 1 },
    { form: '跟', start: 1, end: 2 },
    { form: '我', start: 2, end: 3 },
    { form: '的', start: 3, end: 4 },
    { form: '同学', start: 4, end: 6 },
  ],
}

const timing = build_text_timings({
  ordered_sentence_ids: ['s1'],
  timings: { s1: '0,300|0,200|0,200|0,150|0,400' },
}).get('s1')

// Karaoke highlight on the 3rd token (500–700ms span) at current_ms = 600.
export const KaraokeHighlight: Story<typeof Component> = {
  props: {
    tokens: karaoke_tokens,
    orthography: 'default',
    text: '我跟我的同学',
    timing,
    current_ms: 600,
    is_active: true,
  },
}
