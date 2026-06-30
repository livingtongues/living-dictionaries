import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SideMenu.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 224, height: 560 }],
  page_data: { t: mock_t, url: new URL('http://localhost/demo/entries') },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
} as never

const shared_props = {
  dictionary,
  entry_count: 1234,
  on_close: () => {},
  loading: false,
}

export const Manager: Story<typeof Component> = {
  props: { ...shared_props, is_manager: true, is_editor_or_above: true },
}

export const Editor: Story<typeof Component> = {
  props: { ...shared_props, is_manager: false, is_editor_or_above: true },
}

export const Contributor: Story<typeof Component> = {
  props: { ...shared_props, is_manager: false, is_editor_or_above: false },
}
