import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ReviewBanner.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  return key
}

export const shared_meta: StoryMeta = {
  viewports: [
    { width: 640, height: 420 },
    { width: 360, height: 520 },
  ],
  page_data: { t },
  csr: true,
}

export const WithCategory: Story<typeof Component> = {
  props: {
    review: {
      category: 'truncated',
      note: 'Sense 1: The Spanish definition appears to end abruptly.\nOriginal text: “planta usada para calmar dolores musculares llamada también”\nWhat name is missing?',
    },
    citations: [{ slug: 'enxet-lexicon', locator: 'l. 8,912' }],
    onresolve: () => {},
  },
}

export const LongNote: Story<typeof Component> = {
  props: {
    review: {
      category: 'language_split',
      note: 'Sense 1: I placed “ñakyra’i” in the Guaraní translation instead of the Spanish text.\nOriginal text: “cigarra pequeña, chicharra, ñakyra’i.”\nSpanish translation: “cigarra pequeña, chicharra”\nIs “ñakyra’i” Guaraní, and are both translations now correct?',
    },
    citations: [{ slug: 'enxet-lexicon', locator: 'l. 15,873' }],
    onresolve: () => {},
  },
}

export const ExpandedSourceDetails: Story<typeof Component> = {
  props: {
    review: {
      category: 'other',
      note: 'Sense 1: I left “apye’” out of the Spanish translation because it appears to be Enxet text with no explanation.\nOriginal text: “excremento; estiércol; caca; apye’”\nSpanish translation: “excremento; estiércol; caca”\nIs “apye’” a variant, a separate entry, or part of this translation?',
    },
    citations: [{ slug: 'enxet-lexicon', locator: 'l. 2,809' }],
    onresolve: () => {},
  },
  interactions: async (page) => {
    await page.click('summary')
  },
}

export const NoCategory: Story<typeof Component> = {
  props: {
    review: { category: '', note: 'Possible duplicate of another homograph — the definition nearly matches Negma¹.' },
    onresolve: () => {},
  },
}
