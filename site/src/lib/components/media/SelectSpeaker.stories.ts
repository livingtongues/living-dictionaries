import type { Story, StoryMeta } from 'svelte-look'
import { createRawSnippet } from 'svelte'
import { readable } from 'svelte/store'
import type Component from './SelectSpeaker.svelte'

function t(key: string | { dynamicKey?: string, fallback?: string }): string {
  if (typeof key === 'object')
    return key.fallback || key.dynamicKey || ''
  const labels: Record<string, string> = {
    'audio.select_speaker': 'Select Speaker',
    'entry_field.speaker': 'Speaker',
    'misc.add': 'Add',
  }
  return labels[key] || key
}

const speakers = readable([
  { id: 'sp1', name: 'Ana Marija' },
  { id: 'sp2', name: 'Budra Raspeda' },
])

const sources = readable([
  { id: 'src1', slug: 'smith-2020', abbreviation: 'Smith 2020', citation: 'Smith, Jane. 2020. Example Language Dictionary.' },
  { id: 'src2', slug: 'hmongdictionary-us', abbreviation: null, citation: 'hmongdictionary.us' },
])

const children = createRawSnippet<[{ speaker_id?: string, source_slug?: string }]>(get_attribution => ({
  render: () => {
    const { speaker_id, source_slug } = get_attribution()
    return `<div style="padding: 0.75rem; background: var(--surface, #f5f5f5); border-radius: 0.5rem; font-size: 0.875rem">Upload UI unlocked — speaker: ${speaker_id ?? '—'}, source: ${source_slug ?? '—'}</div>`
  },
}))

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 260 }],
  page_data: { t, speakers, sources },
}

/** No selection yet: speaker dropdown + the "cite a source instead" escape hatch. */
export const ChooseSpeaker: Story<typeof Component> = {
  props: { children },
}

/** Editing media that already has a speaker: children render immediately. */
export const SpeakerPreselected: Story<typeof Component> = {
  props: { initialSpeakerId: 'sp2', children },
}

/** Speaker-less audio attributed to a source: source dropdown selected + children render. */
export const CitingSource: Story<typeof Component> = {
  props: { initial_source_slug: 'hmongdictionary-us', children },
}

/** Clicking the escape hatch swaps to the source picker (no source chosen yet). */
export const SwitchedToSourceMode: Story<typeof Component> = {
  csr: true,
  props: { children },
  interactions: async (page) => {
    await page.waitForSelector('.switch-mode')
    await page.click('.switch-mode')
  },
}

/** No speakers registered yet: Add button + the source escape hatch. */
export const NoSpeakersYet: Story<typeof Component> = {
  props: { children },
  page_data: { t, speakers: readable([]), sources },
}
