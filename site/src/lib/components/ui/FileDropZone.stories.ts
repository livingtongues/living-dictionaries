import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/components/ui/FileDropZone.svelte'
import { createRawSnippet } from 'svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 380 }],
}

const noop = () => {}

const room_snippet = createRawSnippet(() => ({
  render: () => `<div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem">
    <div style="font-weight: 600">Diego, Greg &amp; Jacob</div>
    <div style="padding: 0.6rem 0.8rem; background: var(--surface); border-radius: 0.6rem; max-width: 22rem">Did you get the recording of this morning's calls?</div>
    <div style="padding: 0.6rem 0.8rem; background: var(--surface); border-radius: 0.6rem; max-width: 22rem; align-self: flex-end">Sending it over now — it's a big one.</div>
  </div>`,
}))

export const Idle: Story<typeof Component> = {
  props: { on_files: noop, children: room_snippet },
}

export const DraggingOver: Story<typeof Component> = {
  csr: true,
  props: {
    on_files: noop,
    label: 'Drop files to attach',
    sub_label: 'Up to 10 files, 500 MB each',
    children: room_snippet,
  },
  // The overlay exists only mid-drag, so synthesize the dragenter a real
  // desktop file drag would fire.
  interactions: async (page) => {
    await page.waitForSelector('.drop-zone')
    await page.evaluate(() => {
      const zone = document.querySelector('.drop-zone')
      const data_transfer = new DataTransfer()
      data_transfer.items.add(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))
      zone?.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data_transfer, bubbles: true }))
    })
  },
}
