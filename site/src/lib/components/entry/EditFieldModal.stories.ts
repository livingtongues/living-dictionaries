import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditFieldModal.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 500 }],
  page_data: {
    t: (key: string | { fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || ''
      const labels: Record<string, string> = { 'misc.cancel': 'Cancel', 'misc.save': 'Save' }
      return labels[key] || key
    },
    dictionary: { id: 'demo' },
  },
}

export const Lexeme: Story<typeof Component> = {
  props: {
    display: 'Lexeme',
    value: 'tree',
    field: 'lexeme' as any,
    on_update: () => {},
    on_close: () => {},
  },
}

export const Notes: Story<typeof Component> = {
  props: {
    display: 'Notes',
    value: 'A perennial woody plant.',
    field: 'notes' as any,
    on_update: () => {},
    on_close: () => {},
  },
}
