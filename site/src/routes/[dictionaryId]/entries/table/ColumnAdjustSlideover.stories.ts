import { writable } from 'svelte/store'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ColumnAdjustSlideover.svelte'

const columns = [
  { field: 'lexeme', width: 170, sticky: true, hidden: false },
  { field: 'phonetic', width: 120, sticky: false, hidden: false },
  { field: 'glosses', width: 170, sticky: false, hidden: false },
  { field: 'notes', width: 200, sticky: false, hidden: true },
] as any[]

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t: (key: string | { dynamicKey?: string, fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || key.dynamicKey || ''
      const labels: Record<string, string> = {
        'column.adjust_columns': 'Adjust Columns',
        'column.width': 'Width',
      }
      return labels[key] || key
    },
    preferred_table_columns: writable(columns),
  },
  csr: true,
}

export const Default: Story<typeof Component> = {
  props: { selectedColumn: columns[1], on_close: () => {} },
  interactions: async (page) => {
    await page.waitForSelector('li')
    await new Promise(resolve => setTimeout(resolve, 350))
  },
}
