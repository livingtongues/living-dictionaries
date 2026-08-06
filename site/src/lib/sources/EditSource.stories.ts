import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditSource.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = { 'misc.cancel': 'Cancel', 'misc.save': 'Save' }
  return labels[key] || key
}

const writes = {
  insert_source: async (source: unknown) => { console.info('insert_source', source); return source },
  update_source: async (source: unknown) => { console.info('update_source', source); return source },
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 900 }],
  page_data: { t, writes, sources: { subscribe: (run: (sources: unknown[]) => void) => { run([]); return () => {} } }, dictionary: { id: 'demo' } },
}

export const Create: Story<typeof Component> = {
  props: { source: null, on_close: () => {} },
}

export const CreateWithAbbreviation: Story<typeof Component> = {
  csr: true,
  props: {
    on_close: () => {},
    source: { abbreviation: 'Jones 1999', citation: 'Jones, Alex. 1999. Example Language Dictionary.' } as any,
  },
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

export const DuplicateSlug: Story<typeof Component> = {
  csr: true,
  page_data: {
    t,
    writes,
    dictionary: { id: 'demo' },
    sources: {
      subscribe: (run: (sources: unknown[]) => void) => {
        run([{ id: 'existing-source', slug: 'smith-2020', abbreviation: 'Smith 2020' }])
        return () => {}
      },
    },
  },
  props: {
    source: { abbreviation: 'Smith 2020' } as any,
    on_close: () => {},
    on_saved: () => {},
  },
}
