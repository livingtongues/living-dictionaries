import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HeroUnit.svelte'
import { build_ssr_map } from './map/ssr-map'
import { story_cards, story_dicts, story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
  csr: true,
}

const ssr_map = build_ssr_map({
  points: story_dicts.map(dict => [dict.lng, dict.lat]),
})

export const Desktop: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 720 }],
  props: {
    dicts: story_dicts,
    ssr_map,
    cards: story_cards,
  },
}

export const Wide: Story<typeof Component> = {
  viewports: [{ width: 1920, height: 720 }],
  props: {
    dicts: story_dicts,
    ssr_map,
    cards: story_cards,
  },
}

/** Hovered card: its line + dot label at 100%, all other lines faded out. */
export const CardHover: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 720 }],
  props: {
    dicts: story_dicts,
    ssr_map,
    cards: story_cards,
  },
  interactions: async (page) => {
    await page.waitForSelector('[data-index="4"]')
    await page.hover('[data-index="4"]')
    await new Promise(resolve => setTimeout(resolve, 400))
  },
}

/** Hovering a map dot shows the name/entry-count tooltip (cluster → count + zoom hint). */
export const DotHover: Story<typeof Component> = {
  viewports: [{ width: 1200, height: 720 }],
  props: {
    dicts: story_dicts,
    ssr_map,
    cards: story_cards,
  },
  interactions: async (page) => {
    await page.waitForSelector('canvas')
    const canvas = await page.$('canvas')
    const box = await canvas.boundingBox()
    // sweep the canvas until the cursor lands on a dot
    outer: for (let y = 40; y < box.height - 40; y += 10) {
      for (let x = 40; x < box.width - 40; x += 10) {
        await page.mouse.move(box.x + x, box.y + y)
        const on_dot = await page.$('canvas.hover-dot')
        if (on_dot)
          break outer
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  },
}
