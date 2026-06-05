import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 700 }],
  csr: true,
}

const data = {
  auth_user: { user: { id: 'admin-1', email: 'jwrunner7@gmail.com', name: 'Jacob' } },
}

// The Server tab auto-fetches on mount (no backend in stories → silently errors).
// Click over to the Paste tab to screenshot the full page chrome — 4 source
// tabs + Graph/Cards toggle + the paste form — with no network dependency.
export const PasteTab: PageStory<typeof Component> = {
  props: data as never,
  interactions: async (page) => {
    await page.waitForSelector('button')
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const paste = buttons.find(button => button.textContent?.trim().includes('Paste SQL'))
      paste?.click()
    })
    await new Promise(resolve => setTimeout(resolve, 150))
  },
}
