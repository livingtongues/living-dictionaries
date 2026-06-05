import type { Story, StoryMeta } from 'svelte-look'
import type Component from './schema-graph.svelte'
import { mock_schema } from '../_mock-schema'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 750 }],
  csr: true,
}

// svelte-look mounts into a bare `document.body`, but the graph wrapper is
// `height: 100%` (it fills `.graph-frame` on the real page). Give body a real
// height after mount so xyflow's deferred `fitView` lays the nodes out.
async function size_and_settle(page: any) {
  await page.evaluate(() => {
    document.documentElement.style.height = '100%'
    document.body.style.height = '750px'
    document.body.style.margin = '0'
  })
  await page.waitForSelector('.svelte-flow__node')
  // xyflow's initial fitView ran while the body was still 0-height; re-fit now
  // that the frame has real dimensions.
  await new Promise(resolve => setTimeout(resolve, 300))
  await page.click('.svelte-flow__controls-fitview')
  await new Promise(resolve => setTimeout(resolve, 500))
}

export const Default: Story<typeof Component> = {
  props: {
    schema: mock_schema,
  } as never,
  interactions: size_and_settle,
}
