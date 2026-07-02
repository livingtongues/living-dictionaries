import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  grammar: '### Word order\n\nNahuatl is a *polysynthetic* language; verbs carry subject, object, and tense affixes, so a single word can express a full clause.',
}

export const Viewer: PageStory<typeof Component> = {
  props: { dictionary, is_manager: false, update_grammar: async () => {} } as never,
}

export const ManagerWithContent: PageStory<typeof Component> = {
  props: { dictionary, is_manager: true, update_grammar: async () => {} } as never,
}

export const ManagerEmpty: PageStory<typeof Component> = {
  props: { dictionary: { ...dictionary, grammar: '' }, is_manager: true, update_grammar: async () => {} } as never,
}

// Pre-cutover rows still hold CKEditor HTML — pins the html-era read shim.
export const HtmlEraContent: PageStory<typeof Component> = {
  props: { dictionary: { ...dictionary, grammar: '<h3>Word order</h3><p>Nahuatl is a <i>polysynthetic</i> language; verbs carry subject, object, and tense affixes.</p>' }, is_manager: false, update_grammar: async () => {} } as never,
}
