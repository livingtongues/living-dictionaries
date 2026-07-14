import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
  grammar: '### Word order\n\nNahuatl is a *polysynthetic* language; verbs carry subject, object, and tense affixes, so a single word can express a full clause.',
}

const entries_data = readable({
  tlahtoa: { id: 'tlahtoa', main: { lexeme: { default: 'tlahtoa' } }, senses: [] },
})

const section_rows = [
  { id: 's1', parent_id: null, sort_key: 'a', title: { en: 'Verb morphology' }, body: { en: 'Nahuatl is **polysynthetic**: one verb can encode subject, object, tense, and directionals.' }, entry_id: null, sense_id: null },
  { id: 's1a', parent_id: 's1', sort_key: 'a', title: { en: 'Subject prefixes' }, body: { en: 'Subjects are marked by a prefix in the first verb slot.' }, entry_id: 'tlahtoa', sense_id: null, usage_conditions: { en: 'Only on finite verbs.' } },
  { id: 's1b', parent_id: 's1', sort_key: 'b', title: { en: 'Object prefixes' }, body: { en: 'Objects occupy a second prefix slot.' }, entry_id: null, sense_id: null },
]

function admin_page_data(rows: unknown[]) {
  return {
    t: mock_t,
    dictionary,
    entries_data,
    auth_user: { admin_level: 3 },
    dict_db: { grammar_sections: { rows, loading: false } },
  } as never
}

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, auth_user: { admin_level: 0 } } as never,
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
  props: { dictionary: { ...dictionary, grammar: '<h3>Word order</h3><p>Nahuatl is <i>polysynthetic</i>.</p>' }, is_manager: false, update_grammar: async () => {} } as never,
}

// Admin-3 preview: blob intro PLUS the structured section tree (read + edit controls).
export const Admin3Sections: PageStory<typeof Component> = {
  page_data: admin_page_data(section_rows),
  props: { dictionary, is_manager: true, update_grammar: async () => {} } as never,
}

// Admin-3 on a dict with no sections yet — shows the "Add section" affordance.
export const Admin3Empty: PageStory<typeof Component> = {
  page_data: admin_page_data([]),
  props: { dictionary, is_manager: true, update_grammar: async () => {} } as never,
}
