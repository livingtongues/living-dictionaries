import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditFieldModal.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 500 }],
  page_data: {
    t: (key: string | { fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || ''
      const labels: Record<string, string> = { 'misc.cancel': 'Cancel', 'misc.save': 'Save', 'misc.save_failed': 'Your change could not be saved. Please try again.' }
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

/**
 * The 2026-08-04 §1.2 crash shape: an empty column reaches the editor as SQLite
 * NULL, not `undefined`, so the `value = ''` defaults never fire. It must render
 * an empty editor and save cleanly, not throw on `.trim()`.
 */
export const NullValue: Story<typeof Component> = {
  props: {
    display: 'Phonetic',
    value: null as any,
    field: 'lexeme' as any,
    on_update: () => {},
    on_close: () => {},
  },
}
