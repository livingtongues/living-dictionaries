import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ListEntry.svelte'
import type { EntryData, Tables } from '$lib/types'
import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 700, height: 110 }],
  page_data: { t: mock_t },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  gloss_languages: ['en'],
  orthographies: [
    { code: 'default', name: 'Latin', primary: true },
    { code: 'x-olck', name: 'Ol Chiki' },
    { code: 'x-deva', name: 'Devanagari' },
  ],
} as unknown as Tables<'dictionaries'>

function make_entry(lexeme: Record<string, string>, main_extra: Record<string, unknown> = {}): EntryData {
  return {
    id: 'e1',
    updated_at: '2026-01-01T00:00:00Z',
    main: { lexeme, phonetic: 'foo', ...main_extra },
    senses: [{ id: 's1', glosses: { en: 'water' } }],
  } as unknown as EntryData
}

const shared_props = {
  dictionary,
  can_edit: false,
  writes: {} as GuardedWrites,
}

export const DefaultHeadwordWithAlternate: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ 'default': 'atl', 'x-olck': 'atl-in-olck' }) },
}

export const NoDefaultFallsBackToAlternate: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ 'x-deva': 'atl-in-deva' }) },
}

export const NoDefaultPicksFirstRegistryAlternate: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ 'x-deva': 'atl-in-deva', 'x-olck': 'atl-in-olck' }) },
}

export const HomographNumberSuperscript: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ default: 'caws' }, { homograph: '3' }) },
}
