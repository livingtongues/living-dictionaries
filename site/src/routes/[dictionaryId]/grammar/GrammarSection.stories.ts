import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GrammarSection.svelte'
import { readable } from 'svelte/store'
import { build_section_tree } from './grammar-tree'
import type { GrammarSectionActions } from './grammar-section-actions'
import { mock_t } from '$lib/mocks/mock-t'
import { mock_dict_db } from '$lib/mocks/mock-dict-db'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
} as never

const entries_data = readable({
  tlahtoa: { id: 'tlahtoa', main: { lexeme: { default: 'tlahtoa' } }, senses: [] },
})

const rows = [
  { id: 's1', parent_id: null, sort_key: 'a', title: { en: 'Verb morphology' }, body: { en: 'Nahuatl is **polysynthetic**: a single verb encodes subject, object, and tense affixes, so one word can express a whole clause.' }, entry_id: null, sense_id: null },
  { id: 's1a', parent_id: 's1', sort_key: 'a', title: { en: 'Subject prefixes' }, body: { en: 'Subjects are marked by a prefix in the first slot of the verb.' }, usage_conditions: { en: 'Only on finite verbs — omitted on nominalized forms.' }, entry_id: 'tlahtoa', sense_id: null, slot_id: 'sl1' },
  { id: 's1b', parent_id: 's1', sort_key: 'b', title: { en: 'Object prefixes' }, body: { en: 'Objects occupy a second prefix slot immediately after the subject.' }, entry_id: null, sense_id: null },
]

const clause_slots = [{ id: 'sl1', sort_key: 'a', name: { en: 'Subject' }, code: 'SBJ' }]
const sentences = [
  { id: 'q1', text: { default: 'Ni-tlahtoa' }, translation: { en: 'I speak.' }, discourse_role: 'storyline' },
  { id: 'q2', text: { default: 'Ti-tlahtoa' }, translation: { en: 'You speak.' } },
]
const section_sentences = [
  { id: 'ss1', section_id: 's1a', sentence_id: 'q1', sort_key: 'a' },
  { id: 'ss2', section_id: 's1a', sentence_id: 'q2', sort_key: 'b' },
]
// A headless (title-less) top-level section — the migrated intro a manager may prose-edit.
const intro_rows = [
  { id: 'intro', parent_id: null, sort_key: 'i', title: null, body: { en: 'Nahuatl is a *polysynthetic* language; a single verb can express a whole clause.' }, entry_id: null, sense_id: null },
]
const dict_db = mock_dict_db({ grammar_sections: [...intro_rows, ...rows], clause_slots, sentences, section_sentences })

const [node] = build_section_tree(rows as never)
const [intro_node] = build_section_tree(intro_rows as never)

const read_actions: GrammarSectionActions = {
  editable: false,
  prose_editable: false,
  editing_id: null,
  set_editing() {},
  move_up() {},
  move_down() {},
  indent() {},
  outdent() {},
  remove() {},
  add_child() {},
}
const edit_actions: GrammarSectionActions = { ...read_actions, editable: true }
const prose_actions: GrammarSectionActions = { ...read_actions, prose_editable: true }

export const shared_meta: StoryMeta = {
  viewports: [{ width: 760, height: 620 }],
  page_data: { t: mock_t, dictionary, entries_data, dict_db } as never,
}

export const ReadOnly: Story<typeof Component> = {
  props: { node, actions: read_actions } as never,
}

export const Editable: Story<typeof Component> = {
  props: { node, actions: edit_actions } as never,
}

// Manager (non-admin-3) on the headless intro: a single scoped prose "edit" button.
export const ManagerProse: Story<typeof Component> = {
  props: { node: intro_node, actions: prose_actions } as never,
}
