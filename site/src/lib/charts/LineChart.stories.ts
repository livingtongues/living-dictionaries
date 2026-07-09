import type { Story, StoryMeta } from 'svelte-look'
import type Component from './LineChart.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 820, height: 300 }, { width: 380, height: 300 }],
  csr: true,
}

const series = [
  { date: '2025-01', value: 12000 }, { date: '2025-03', value: 14500 }, { date: '2025-06', value: 18000 },
  { date: '2025-09', value: 22000 }, { date: '2025-12', value: 27000 }, { date: '2026-03', value: 33000 },
  { date: '2026-06', value: 40000 },
]

export const Default: Story<typeof Component> = {
  props: { series, area: true, height: 240 } as never,
}

export const WithEvent: Story<typeof Component> = {
  props: {
    series,
    area: true,
    height: 240,
    events: [{ date: '2025-09', label: 'Pricing change', color: 'var(--warning)' }],
  } as never,
}

// Keyboard nav: focus the svg, then two ArrowRights snap the crosshair + tooltip to
// the second point — no mouse needed.
export const KeyboardFocus: Story<typeof Component> = {
  props: { series, area: true, height: 240 } as never,
  interactions: async (page) => {
    await page.waitForSelector('svg')
    await page.evaluate(() => (document.querySelector('svg') as unknown as HTMLElement).focus())
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await new Promise(resolve => setTimeout(resolve, 150))
  },
}

// A realistic deploy burst over an errors-per-day timeline: mostly 0, a couple of
// spikes, then ~7 ships clustered in the last two days — the vertical-pile case.
const burst_end = new Date('2026-06-28T00:00:00Z')
const burst_day = (offset: number) => new Date(burst_end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
const burst_days = Array.from({ length: 30 }, (_, i) => burst_day(29 - i))
const burst_errors = burst_days.map((_, i) => (i === 4 ? 9 : i === 18 ? 4 : i >= 27 ? 6 + (i - 27) * 4 : i % 6 === 0 ? 1 : 0))
const burst_deploys = [
  { day: burst_day(20), at: '09:12' }, { day: burst_day(11), at: '14:40' },
  { day: burst_day(1), at: '01:18' }, { day: burst_day(1), at: '02:51' },
  { day: burst_day(1), at: '03:44' }, { day: burst_day(1), at: '04:34' },
  { day: burst_day(0), at: '05:45' }, { day: burst_day(0), at: '08:55' },
  { day: burst_day(0), at: '11:20', current: true },
]

const burst_props = {
  series: burst_days.map((date, i) => ({ date, value: burst_errors[i] })),
  area: true,
  height: 200,
  color: 'var(--danger)',
  events: burst_deploys.map(d => ({
    date: d.day,
    label: `🚀 ${d.at}`,
    color: d.current ? 'var(--primary)' : 'var(--color-secondary)',
    current: d.current,
    note: { title: d.current ? 'Deploy (current build)' : 'Deploy', items: [{ label: '1782…', text: 'commit subject' }] },
  })),
}

export const DeployBurst: Story<typeof Component> = { props: burst_props as never }

// Pins the clustered tick's popover open so the hover state is screenshot-verifiable.
export const DeployBurstOpen: Story<typeof Component> = {
  props: burst_props as never,
  interactions: async (page) => {
    await page.waitForSelector('.tick.current')
    await page.click('.tick.current')
    await new Promise(resolve => setTimeout(resolve, 150))
  },
}
