import type { Story, StoryMeta } from 'svelte-look'
import type Component from './QuestionList.svelte'
import type { ThreadQuestionRow } from '$lib/db/server/import-conversations'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 760, height: 700 }, { width: 390, height: 900 }],
}

function question(overrides: Partial<ThreadQuestionRow> = {}): ThreadQuestionRow {
  return {
    id: 'q1',
    thread_id: 't1',
    dictionary_id: 'demo',
    position: 1,
    kind: 'text',
    title: 'Who compiled this list, roughly when, and from what?',
    body_html: 'Even “a 1990s community class handout” lets us cite it properly.',
    options_json: null,
    report_anchor: '#q-provenance',
    entries_query: null,
    entries_query_label: null,
    answer_text: null,
    answer_values_json: null,
    answered_by_user_id: null,
    answered_at: null,
    status: 'open',
    created_at: '2026-07-25T09:00:00Z',
    updated_at: '2026-07-25T09:00:00Z',
    ...overrides,
  }
}

const base = { dictionary_id: 'demo', thread_id: 't1', report_artifact_id: 'a1', on_answered: () => {} }

/** The real Eastern Pomo shape: open prose, a choice question, and one already answered. */
export const MixedKinds: Story<typeof Component> = {
  props: {
    ...base,
    questions: [
      question(),
      question({
        id: 'q1b',
        position: 2,
        title: 'Should I keep the parts of speech I worked out from the English?',
        body_html: 'I inferred these from the English gloss, so a speaker should confirm the pattern before we keep them.',
        report_anchor: '#q-parts-of-speech',
        entries_query: JSON.stringify({ sources: ['mg-bitd-wordlist'], no_part_of_speech: true }),
        entries_query_label: 'Show me these 1,191 entries',
      }),
      question({
        id: 'q2',
        position: 2,
        kind: 'choice',
        title: 'Is the raised dot a morpheme break or vowel length?',
        body_html: '31 words use it. 27 sit before a <code>-hi</code>/<code>-le</code> ending; 2 look like length.',
        options_json: JSON.stringify([
          { value: 'morpheme', label: 'Morpheme break' },
          { value: 'length', label: 'Vowel length' },
          { value: 'unsure', label: 'Not sure — please investigate' },
        ]),
        report_anchor: '#q-raised-dot',
        // No label of its own — falls back to the translated default.
        entries_query: JSON.stringify({ query: '·' }),
      }),
      question({
        id: 'q3',
        position: 3,
        title: 'Should “Mission Dialect” become a real dialect label?',
        body_html: null,
        report_anchor: null,
        answer_text: 'Yes — and Upper Lake too. They are distinct communities.',
        answered_by_user_id: 'u1',
        answered_at: '2026-07-26T10:00:00Z',
        status: 'answered',
      }),
    ],
  },
}

/** All answered — the block reads as done rather than as a to-do list. */
export const AllAnswered: Story<typeof Component> = {
  props: {
    ...base,
    questions: [
      question({ answer_text: 'A 1990s community class handout.', answered_at: '2026-07-26T10:00:00Z', answered_by_user_id: 'u1', status: 'answered' }),
    ],
  },
}
