import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
}

const entries_data = readable({
  tlahtoa: { id: 'tlahtoa', main: { lexeme: { default: 'tlahtoa' } }, senses: [] },
})

// The migrated blob: a headless (title-less) top-level section — the node a
// plain manager may edit the prose of.
const headless_intro = [
  { id: 'intro', parent_id: null, sort_key: 'i', title: null, body: { en: 'Nahuatl is a *polysynthetic* language; verbs carry subject, object, and tense affixes, so a single word can express a full clause.' }, entry_id: null, sense_id: null },
]

const section_rows = [
  { id: 's1', parent_id: null, sort_key: 'a', title: { en: 'Verb morphology' }, body: { en: 'Nahuatl is **polysynthetic**: one verb can encode subject, object, tense, and directionals.' }, entry_id: null, sense_id: null },
  { id: 's1a', parent_id: 's1', sort_key: 'a', title: { en: 'Subject prefixes' }, body: { en: 'Subjects are marked by a prefix in the first verb slot.' }, entry_id: 'tlahtoa', sense_id: null, usage_conditions: { en: 'Only on finite verbs.' }, slot_id: 'sl1' },
  { id: 's1b', parent_id: 's1', sort_key: 'b', title: { en: 'Object prefixes' }, body: { en: 'Objects occupy a second prefix slot.' }, entry_id: null, sense_id: null, slot_id: 'sl2' },
]

const clause_slots = [
  { id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' },
  { id: 'sl2', sort_key: 'b', name: { en: 'Object' }, code: 'OBJ' },
  { id: 'sl3', sort_key: 'c', name: { en: 'Verb stem' }, code: 'V' },
]

const sentences = [
  { id: 'q1', text: { default: 'Ni-tlahtoa' }, translation: { en: 'I speak.' }, discourse_role: 'storyline' },
  { id: 'q2', text: { default: 'Ti-tlahtoa' }, translation: { en: 'You speak.' } },
]

const section_sentences = [
  { id: 'ss1', section_id: 's1a', sentence_id: 'q1', sort_key: 'a' },
  { id: 'ss2', section_id: 's1a', sentence_id: 'q2', sort_key: 'b' },
]

function page_data({ rows, admin_level = 0 }: { rows: { id: string }[], admin_level?: number }) {
  return {
    t: mock_t,
    dictionary,
    entries_data,
    auth_user: { admin_level },
    writes: {},
    dict_db: mock_dict_db({ grammar_sections: rows, clause_slots, sentences, section_sentences }),
  } as never
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 820, height: 940 }],
  page_data: { t: mock_t, auth_user: { admin_level: 0 } } as never,
}

// Public viewer (post-cutover): the section tree renders read-only for everyone.
export const Viewer: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows }),
  props: { dictionary, is_manager: false } as never,
}

// Public viewer on a dict with no grammar yet — "no info yet".
export const ViewerEmpty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [] }),
  props: { dictionary, is_manager: false } as never,
}

// Manager (non-admin-3): sees the migrated intro with a scoped prose "edit" only.
export const ManagerProse: PageStory<typeof Component> = {
  page_data: page_data({ rows: headless_intro }),
  props: { dictionary, is_manager: true } as never,
}

// Manager on a dict with no grammar at all — the "Add grammar" affordance.
export const ManagerEmpty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [] }),
  props: { dictionary, is_manager: true } as never,
}

// Admin-3: the full structured section tree with edit / reorder / nest controls.
export const Admin3Sections: PageStory<typeof Component> = {
  page_data: page_data({ rows: section_rows, admin_level: 3 }),
  props: { dictionary, is_manager: true } as never,
}

// Admin-3 on a dict with no sections yet — shows the "Add section" affordance.
export const Admin3Empty: PageStory<typeof Component> = {
  page_data: page_data({ rows: [], admin_level: 3 }),
  props: { dictionary, is_manager: true } as never,
}
