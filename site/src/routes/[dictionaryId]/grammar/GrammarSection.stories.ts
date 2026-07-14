import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GrammarSection.svelte'
import { readable } from 'svelte/store'
import { build_section_tree } from './grammar-tree'
import type { GrammarSectionActions } from './grammar-section-actions'
import { mock_t } from '$lib/mocks/mock-t'

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
  { id: 's1a', parent_id: 's1', sort_key: 'a', title: { en: 'Subject prefixes' }, body: { en: 'Subjects are marked by a prefix in the first slot of the verb.' }, usage_conditions: { en: 'Only on finite verbs — omitted on nominalized forms.' }, entry_id: 'tlahtoa', sense_id: null },
  { id: 's1b', parent_id: 's1', sort_key: 'b', title: { en: 'Object prefixes' }, body: { en: 'Objects occupy a second prefix slot immediately after the subject.' }, entry_id: null, sense_id: null },
]

const [node] = build_section_tree(rows as never)

const read_actions: GrammarSectionActions = {
  editable: false,
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

export const shared_meta: StoryMeta = {
  viewports: [{ width: 760, height: 560 }],
  page_data: { t: mock_t, dictionary, entries_data },
}

export const ReadOnly: Story<typeof Component> = {
  props: { node, actions: read_actions } as never,
}

export const Editable: Story<typeof Component> = {
  props: { node, actions: edit_actions } as never,
}
