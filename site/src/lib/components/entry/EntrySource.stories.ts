import { writable } from 'svelte/store'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EntrySource.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = { 'misc.add': 'add', 'misc.cancel': 'Cancel', 'misc.save': 'Save', 'entry_field.sources': 'Source' }
  return labels[key] || key
}

const sources = writable([
  { id: 's1', slug: 'smith-2020', abbreviation: 'Smith 2020', citation: 'Smith 2020.' },
  { id: 's2', slug: 'lee-1998', abbreviation: 'Lee 1998', citation: 'Lee 1998.' },
])

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 220 }],
  page_data: { t, sources },
}

export const WithSources: Story<typeof Component> = {
  props: { can_edit: true, value: ['smith-2020', 'lee-1998'], on_update: (v: string[]) => console.info(v) },
}

export const Empty: Story<typeof Component> = {
  props: { can_edit: true, value: [], on_update: (v: string[]) => console.info(v) },
}

export const WithCitationLocators: Story<typeof Component> = {
  props: {
    can_edit: false,
    value: ['smith-2020'],
    citations: [{ slug: 'smith-2020', locator: 'p. 42' }, { slug: 'lee-1998', locator: 'ex. 3b' }],
    on_update: (v: string[]) => console.info(v),
  },
}
