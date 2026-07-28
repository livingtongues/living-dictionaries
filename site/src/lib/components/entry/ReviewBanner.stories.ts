import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ReviewBanner.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  return key
}

export const shared_meta: StoryMeta = {
  viewports: [
    { width: 640, height: 460 },
    { width: 360, height: 560 },
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

export const DefinitionComparison: Story<typeof Component> = {
  props: {
    review: {
      category: 'definition-differs',
      note: 'The book’s two halves define this word differently. Which should the entry say?',
      comparisons: [{
        field: 'Definition',
        a: { label: 'Main dictionary (p62)', value: 'to point at a particular animate or inanimate thing' },
        b: { label: 'English finder list (p345)', value: 'to point at a particular inanimate thing' },
        apply: { target: 'sense.definition', sense_id: '11111111-2222-3333-4444-555555555555', key: 'en' },
      }],
    },
    citations: [{ slug: 'headman-oneill-2019', locator: 'pdf p62' }],
    current_value: () => 'to point at a particular animate or inanimate thing',
    onapply: () => {},
    onresolve: () => {},
  },
}

export const RespellingComparison: Story<typeof Component> = {
  props: {
    review: {
      category: 'respelling-differs',
      note: 'The book’s two halves spell this pronunciation differently. Which is right?',
      comparisons: [{
        field: 'Pronunciation guide',
        a: { label: 'Main dictionary (p64)', value: 'äʼ-bä-chē-zhāʼ' },
        b: { label: 'English finder list (p310)', value: 'äʼ-bā-chē-zhāʼ' },
        apply: { target: 'entry.lexeme', key: 'pronunciation' },
      }],
    },
    citations: [{ slug: 'headman-oneill-2019', locator: 'pdf p64' }],
    current_value: () => 'äʼ-bä-chē-zhāʼ',
    onapply: () => {},
    onresolve: () => {},
  },
}

export const TwoComparisons: Story<typeof Component> = {
  props: {
    review: {
      category: 'definition-differs',
      note: 'The book’s two halves disagree about this entry. Which should it say?',
      comparisons: [
        {
          field: 'Definition',
          a: { label: 'Main dictionary (p102)', value: 'to strike something, making a dull sound' },
          b: { label: 'English finder list (p280)', value: 'a dull, heavy sound made by a heavy object impacting a surface' },
          apply: { target: 'sense.definition', sense_id: '11111111-2222-3333-4444-555555555555', key: 'en' },
        },
        {
          field: 'Translation',
          a: { label: 'Main dictionary (p102)', value: 'thud' },
          b: { label: 'English finder list (p280)', value: 'dull sound' },
          apply: { target: 'sense.glosses', sense_id: '11111111-2222-3333-4444-555555555555', key: 'en' },
        },
      ],
    },
    citations: [{ slug: 'headman-oneill-2019', locator: 'pdf p102' }],
    current_value: comparison => comparison.a.value,
    onapply: () => {},
    onresolve: () => {},
  },
}

export const ComparisonWithoutApply: Story<typeof Component> = {
  props: {
    review: {
      category: 'possibly-two-words',
      note: 'The finder list files this word under “hesitate”, which shares no meaning with the senses here — the two halves may be describing different words that happen to be spelled alike. Does everything here belong to one word?',
      comparisons: [{
        field: 'Definition',
        a: { label: 'Main dictionary (p65)', value: 'to lean back against something' },
        b: { label: 'English finder list (p305)', value: 'to hesitate, to hold back from acting' },
      }],
    },
    citations: [{ slug: 'headman-oneill-2019', locator: 'pdf p65' }],
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
