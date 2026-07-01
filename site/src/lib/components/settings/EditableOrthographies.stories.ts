import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditableOrthographies.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 460, height: 420 }],
  page_data: { t: mock_t, dict_db: null, url: new URL('http://localhost/demo/settings') },
}

function dict(orthographies: unknown) {
  return { id: 'demo', url: 'demo', name: 'Demo', orthographies } as never
}

const on_update = async () => {}

export const FreshDictionary: Story<typeof Component> = {
  props: { dictionary: dict(null), on_update },
}

export const WithAlternates: Story<typeof Component> = {
  props: {
    dictionary: dict([
      { code: 'default', name: 'Latin', bcp: 'sat-Latn', primary: true },
      { code: 'sat-Olck', name: 'Ol Chiki', bcp: 'sat-Olck' },
      { code: 'village-spelling', name: 'Village spelling' },
    ]),
    on_update,
  },
}
