import type { Story, StoryMeta } from 'svelte-look'
import type Component from './DomainsPanel.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, locale: 'en' },
}

const domains = [
  { key: 'Universe_and_the_natural_world', label: 'Universe and the natural world', count: 1386 },
  { key: 'Plants,_trees_and_other_vegetation', label: 'Plants, trees and other vegetation', count: 1048 },
  { key: 'Animals', label: 'Animals', count: 660 },
  { key: 'Physical_Actions', label: 'Physical Actions', count: 547 },
  { key: 'Body_parts', label: 'Body parts', count: 310 },
  { key: 'Birds', label: 'Birds', count: 303 },
  { key: 'Food,_cooking_and_foodways', label: 'Food, cooking and foodways', count: 295 },
  { key: 'States_and_Characteristics', label: 'States and Characteristics', count: 259 },
  { key: 'Insects_and_small_creatures', label: 'Insects and small creatures', count: 243 },
  { key: 'Tools_and_weapons', label: 'Tools and weapons', count: 226 },
]

/** Long labels wrap (never ellipsize) — most visible on the mobile viewport. */
export const TopDomains: Story<typeof Component> = {
  viewports: [{ width: 900, height: 420 }, { width: 390, height: 620 }],
  props: {
    domains,
    entries_href: '/gta/entries',
  },
}

/** Three domains — the minimum that renders (panel is hidden at ≤2 domains in use). */
export const FewDomains: Story<typeof Component> = {
  viewports: [{ width: 700, height: 320 }],
  props: {
    domains: domains.slice(0, 3),
    entries_href: '/gta/entries',
  },
}
