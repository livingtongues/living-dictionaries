import type { Story, StoryMeta } from 'svelte-look'
import type Component from './reaction-picker.svelte'

export const shared_meta: StoryMeta = {
  // The picker anchors bottom:100% (opens upward), so give it headroom.
  viewports: [{ width: 320, height: 320 }],
}

/** The quick-reaction row (default). */
export const QuickRow: Story<typeof Component> = {
  props: { on_pick: () => {}, close: () => {} },
}

/** Expanded full palette after clicking "＋". */
export const FullPalette: Story<typeof Component> = {
  csr: true,
  props: { on_pick: () => {}, close: () => {} },
  interactions: async (page) => {
    await page.waitForSelector('.more-btn')
    await page.click('.more-btn')
    await page.waitForSelector('.full-grid')
  },
}
