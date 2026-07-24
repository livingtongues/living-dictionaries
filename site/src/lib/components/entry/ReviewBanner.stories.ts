import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ReviewBanner.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  return key
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 260 }],
  page_data: { t },
  csr: true,
}

export const WithCategory: Story<typeof Component> = {
  props: {
    review: { category: 'truncated', note: 'The Spanish definition looks cut off in the source (ends "…; pl"). Check the original and complete it.' },
    onresolve: () => {},
  },
}

export const LongNote: Story<typeof Component> = {
  props: {
    review: {
      category: 'language_split',
      note: 'Sense 2: a Guaraní form ("tajykatĩ") was auto-split out of the Spanish definition into glosses.gn — verify it belongs there.\nSense 3: the headword echoed inside its own definition; a packed example was lifted to notes.',
    },
    onresolve: () => {},
  },
}

export const NoCategory: Story<typeof Component> = {
  props: {
    review: { category: '', note: 'Possible duplicate of another homograph — the definition nearly matches Negma¹.' },
    onresolve: () => {},
  },
}
