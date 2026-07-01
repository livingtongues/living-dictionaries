import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditSource.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = { 'misc.cancel': 'Cancel', 'misc.save': 'Save' }
  return labels[key] || key
}

const dbOperations = {
  insert_source: async (source: unknown) => { console.info('insert_source', source); return source },
  update_source: async (source: unknown) => { console.info('update_source', source); return source },
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 720 }],
  page_data: { t, dbOperations },
}

export const Create: Story<typeof Component> = {
  props: { source: null, on_close: () => {} },
}

export const Edit: Story<typeof Component> = {
  props: {
    on_close: () => {},
    source: {
      id: 's1',
      slug: 'smith-2020',
      citation: 'Smith, Jane. 2020. Example Language Dictionary. City: Example University Press.',
      abbreviation: 'Smith 2020',
      author: 'Jane Smith',
      year: '2020',
      url: '',
      license: '',
      type: 'dictionary',
    } as any,
  },
}
