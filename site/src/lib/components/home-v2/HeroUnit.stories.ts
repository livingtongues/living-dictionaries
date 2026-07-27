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

const connector_dict = { ...story_dicts[2], lat: 0, lng: 0 }
const connector_card = {
  ...story_cards[0],
  dict_id: connector_dict.id,
  dict_url: connector_dict.url,
  dict_name: connector_dict.name,
  lat: connector_dict.lat,
  lng: connector_dict.lng,
}

/** Clicking the entry-count suffix of a red connector label opens its dictionary popover. */
export const ConnectorEntryCountClick: Story<typeof Component> = {
  viewports: [{ width: 720, height: 620 }],
  props: {
    dicts: [connector_dict],
    ssr_map: build_ssr_map({ points: [[connector_dict.lng, connector_dict.lat]] }),
    cards: [connector_card],
  },
  interactions: async (page) => {
    await page.waitForSelector('canvas')
    await page.hover('.card')
    await new Promise(resolve => setTimeout(resolve, 500))
    const canvas = await page.$('canvas')
    const canvas_box = await canvas.boundingBox()
    // Equal Earth's cropped visible-world fit places [0, 0] slightly left and
    // below center. Sweep only the right-hand suffix area (outside "Kihunde")
    // so minor font rasterization differences cannot make the story flaky.
    let suffix_point: { x: number, y: number } | null = null
    outer: for (let y_ratio = 0.48; y_ratio <= 0.6; y_ratio += 0.01) {
      for (let x_ratio = 0.48; x_ratio <= 0.55; x_ratio += 0.01) {
        const x = canvas_box.x + canvas_box.width * x_ratio
        const y = canvas_box.y + canvas_box.height * y_ratio
        await page.mouse.move(x, y)
        if (await page.$('canvas.hover-dot')) {
          suffix_point = { x, y }
          break outer
        }
      }
    }
    if (!suffix_point)
      throw new Error('The entry-count suffix was not clickable')
    await page.mouse.click(suffix_point.x, suffix_point.y)
    await page.waitForSelector('.popover')
  },
}
