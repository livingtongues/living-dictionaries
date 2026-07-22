import type { Story, StoryMeta } from 'svelte-look'
import type Component from './segmented-bar.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 80 }],
}

const counts = { reviewed: 620, ai: 250, en_changed: 60, missing: 71 }
const total = counts.reviewed + counts.ai + counts.en_changed + counts.missing

/** The big bar as seen in the language header — clickable segments, no filter focused. */
export const Full: Story<typeof Component> = {
  props: { counts, total, size: 'full', onpick: () => {} },
}

/** Focusing the AI filter dims the other segments. */
export const FullFocusedAi: Story<typeof Component> = {
  props: { counts, total, size: 'full', active_filter: 'ai', onpick: () => {} },
}

/** The compact card version (no interaction). */
export const Mini: Story<typeof Component> = {
  viewports: [{ width: 180, height: 40 }],
  props: { counts, total, size: 'mini' },
}

/** Fully reviewed → a single green fill. */
export const Complete: Story<typeof Component> = {
  props: { counts: { reviewed: total, ai: 0, en_changed: 0, missing: 0 }, total, size: 'full', onpick: () => {} },
}
