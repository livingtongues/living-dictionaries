import type { Story, StoryMeta } from 'svelte-look'
import type Component from './HeroSearchBar.svelte'
import { story_dicts, story_t } from './story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: story_t, locale: 'en' },
}

const story_my_dictionaries = [
  { id: 'haryanvi', url: 'haryanvi', name: 'Haryanvi' },
  { id: 'sengwer', url: 'sengwer', name: 'Sengwer' },
  { id: 'achi', url: 'achi', name: 'Achi' },
] as unknown as Story<typeof Component>['props']['my_dictionaries']

/** Desktop width — search input and quick-jump pills sit side by side, vertically centered. */
export const Desktop: Story<typeof Component> = {
  viewports: [{ width: 900, height: 100 }],
  props: { dicts: story_dicts, my_dictionaries: story_my_dictionaries },
}

/** Narrow width — quick-jump pills wrap below the search input. */
export const Mobile: Story<typeof Component> = {
  viewports: [{ width: 375, height: 180 }],
  props: { dicts: story_dicts, my_dictionaries: story_my_dictionaries },
}

/** Long dictionary name — pill truncates with ellipsis, full name on hover. */
export const LongName: Story<typeof Component> = {
  viewports: [{ width: 900, height: 100 }],
  props: {
    dicts: story_dicts,
    my_dictionaries: [
      { id: 'zapoteco', url: 'zapoteco', name: 'Zapoteco de la sierra norte, San Juan Bautista Atascadero' },
      { id: 'haryanvi', url: 'haryanvi', name: 'Haryanvi' },
      { id: 'sengwer', url: 'sengwer', name: 'Sengwer' },
    ] as unknown as Story<typeof Component>['props']['my_dictionaries'],
  },
}
