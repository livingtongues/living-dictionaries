import type { DeployMetric } from '$lib/db/server/deploy-metrics'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DeploysPanel.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 900, height: 480 }],
  flavors: false,
}

/** ~30 deploys: journal-backfilled totals first, then instrumented phase records + one failure. */
export function build_deploys(machine = 'living'): DeployMetric[] {
  const out: DeployMetric[] = []
  const start = new Date('2026-06-16T06:00:00.000Z')
  for (let index = 0; index < 30; index++) {
    const at = new Date(start.getTime() + index * 11 * 3600_000).toISOString().slice(0, 19)
    const cached = index % 4 === 1
    const total_s = cached ? 75 + (index % 3) * 6 : 160 + Math.round(Math.sin(index) * 30) + (index === 22 ? 220 : 0)
    const sha = (0x100000 + index * 0x8F31).toString(16).padStart(7, 'a')
    if (index === 17) {
      out.push({ at: `${at}Z`, machine, outcome: 'failed', total_s: 48, sha })
      continue
    }
    if (index < 20) {
      out.push({ at: `${at}Z`, machine, outcome: 'complete', total_s, sha, green_wait_s: 2, blue_wait_s: 3 + (index % 9), backfilled: true })
      continue
    }
    const rollout_s = 8 + (index % 9)
    out.push({
      at: `${at}Z`,
      machine,
      outcome: 'complete',
      total_s,
      sha,
      pull_s: 4,
      preflight_s: 1,
      build_s: total_s - rollout_s - 5,
      rollout_s,
      green_wait_s: 2,
      blue_wait_s: 3 + (index % 9),
    })
  }
  return out
}

export const Default: Story<typeof Component> = {
  props: { deploys: build_deploys() },
}

/** Journal-backfilled records only (no phase breakdown yet) — the day-one state. */
export const BackfilledOnly: Story<typeof Component> = {
  props: { deploys: build_deploys().slice(0, 18) },
}

export const TableOpen: Story<typeof Component> = {
  viewports: [{ width: 900, height: 900 }],
  csr: true,
  interactions: async (page) => {
    await page.click('summary')
  },
  props: { deploys: build_deploys() },
}

export const Empty: Story<typeof Component> = {
  viewports: [{ width: 900, height: 140 }],
  props: { deploys: [] },
}
