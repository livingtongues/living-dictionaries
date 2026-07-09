import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ComboChart.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 880, height: 360 }, { width: 380, height: 360 }],
  csr: true,
}

const dates = ['2024-01', '2024-06', '2024-12', '2025-06', '2025-12', '2026-06']
const total = [120000, 150000, 190000, 230000, 290000, 360000]
const invested = [90000, 110000, 150000, 180000, 230000, 300000]

export const Default: Story<typeof Component> = {
  props: {
    series: [
      { label: 'Net worth', color: 'var(--primary)', points: dates.map((date, i) => ({ date, value: total[i] })), area: true },
      { label: 'Invested', color: '#06b6d4', points: dates.map((date, i) => ({ date, value: invested[i] })) },
    ],
    height: 320,
    gaps: [{ label: 'Cash', from: 0, to: 1 }],
  } as never,
}

const default_props = {
  series: [
    { label: 'Net worth', color: 'var(--primary)', points: dates.map((date, i) => ({ date, value: total[i] })), area: true },
    { label: 'Invested', color: '#06b6d4', points: dates.map((date, i) => ({ date, value: invested[i] })) },
  ],
  height: 320,
  gaps: [{ label: 'Cash', from: 0, to: 1 }],
}

// Legend toggle: clicking the second legend button hides the "Invested" series;
// the y-domain + tooltip recompute around the remaining series.
export const LegendToggle: Story<typeof Component> = {
  props: default_props as never,
  interactions: async (page) => {
    const buttons = await page.$$('.legend .item')
    await buttons[1].click()
    await new Promise(resolve => setTimeout(resolve, 150))
  },
}

// Keyboard nav: focus the svg, then ArrowRights step the shared tooltip across dates.
export const KeyboardFocus: Story<typeof Component> = {
  props: default_props as never,
  interactions: async (page) => {
    await page.waitForSelector('svg')
    await page.evaluate(() => (document.querySelector('svg') as unknown as HTMLElement).focus())
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await new Promise(resolve => setTimeout(resolve, 150))
  },
}

// Two events sharing the same label (e.g. deploy markers at the same HH:MM on
// different days) must NOT crash with each_key_duplicate — evts is index-keyed.
export const DuplicateEventLabels: Story<typeof Component> = {
  props: {
    series: [
      { label: 'Sessions', color: 'var(--primary)', points: dates.map((date, i) => ({ date, value: total[i] })) },
    ],
    height: 320,
    events: [
      { date: '2024-06', label: '🚀 01:18', color: 'var(--primary)' },
      { date: '2025-06', label: '🚀 01:18', color: '#94a3b8' },
    ],
  } as never,
}

// A realistic deploy burst: most days quiet, then ~7 ships clustered in the last two
// days (the pileup case) + 2 spread earlier — matches production reality for the rail.
const burst_end = new Date('2026-06-28T00:00:00Z')
const burst_day = (offset: number) => new Date(burst_end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
const burst_days = Array.from({ length: 30 }, (_, i) => burst_day(29 - i))
const burst_sessions = burst_days.map((_, i) => Math.round(8 + Math.max(0, i - 22) ** 2 * 6 + Math.sin(i) * 4))
export const burst_deploys = [
  { day: burst_day(20), at: '09:12', subject: 'Rework proofread into side-by-side review' },
  { day: burst_day(11), at: '14:40', subject: 'Newsletter sender + contacts CRM' },
  { day: burst_day(1), at: '01:18', subject: 'Clean up resolved reader-wedge issues' },
  { day: burst_day(1), at: '02:51', subject: 'Side-by-side proofread review polish' },
  { day: burst_day(1), at: '03:44', subject: 'Log image-upload failures durably' },
  { day: burst_day(1), at: '04:34', subject: 'Fix reader wedge on iOS Safari' },
  { day: burst_day(0), at: '05:45', subject: 'Geo split for TTFB by distance' },
  { day: burst_day(0), at: '08:55', subject: 'Zero-downtime blue/green deploy' },
  { day: burst_day(0), at: '11:20', subject: 'Analytics dashboard panels + log CLI', current: true },
]

const burst_props = {
  series: [
    { label: 'Sessions', color: 'var(--primary)', points: burst_days.map((date, i) => ({ date, value: burst_sessions[i] })), area: true },
    { label: 'Users', color: '#06b6d4', points: burst_days.map((date, i) => ({ date, value: Math.round(burst_sessions[i] * 0.18) })) },
  ],
  height: 200,
  events: burst_deploys.map(d => ({
    date: d.day,
    label: `🚀 ${d.at}`,
    color: d.current ? 'var(--primary)' : 'var(--color-secondary)',
    current: d.current,
    note: { title: d.current ? 'Deploy (current build)' : 'Deploy', items: [{ label: '1782…', text: d.subject }] },
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
