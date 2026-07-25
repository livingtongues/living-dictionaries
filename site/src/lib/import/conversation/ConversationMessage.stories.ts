import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ConversationMessage.svelte'
import type { ConversationMessageForClient } from '$api/v1/dictionaries/[id]/conversations/[thread_id]/+server'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 700, height: 140 }],
}

function message(overrides: Partial<ConversationMessageForClient> = {}): ConversationMessageForClient {
  return {
    id: 'm1',
    thread_id: 't1',
    author_user_id: 'u1',
    author_kind: 'customer',
    body_text: 'The handwritten notes in the margins are important — please include them where practical.',
    message_id: null,
    created_at: '2026-07-25T09:00:00Z',
    author: { user_id: 'u1', name: 'Jim Cirelli', email: 'jim@example.com', is_team: false },
    ...overrides,
  }
}

/** Someone else on the dictionary's side. */
export const FromManager: Story<typeof Component> = {
  props: { message: message(), current_user_id: 'someone-else' },
}

/** The viewer's own message reads as "You". */
export const FromYou: Story<typeof Component> = {
  props: { message: message(), current_user_id: 'u1' },
}

/** Our reply — accent avatar plus the team tag. */
export const FromTeam: Story<typeof Component> = {
  props: {
    message: message({
      id: 'm2',
      author_kind: 'admin',
      body_text: 'Your word list is in the dictionary — 1,827 entries. The report below walks through everything, and there are six things I would love your help with.',
      author: { user_id: 'u-jacob', name: 'Jacob Runner', email: 'jacob@livingtongues.org', is_team: true },
    }),
    current_user_id: 'u1',
  },
}

/** A machine-generated event — a quiet centered line, not anyone's message. */
export const SystemEvent: Story<typeof Component> = {
  props: {
    message: message({
      id: 'm4',
      author_kind: 'system',
      body_text: 'Jim Cirelli updated the details for eastern-pomo-wordlist.xlsx.',
    }),
    current_user_id: 'u1',
  },
}

/** An agent finishing a job speaks in the same voice as the rest of the team. */
export const FromAgent: Story<typeof Component> = {
  props: {
    message: message({
      id: 'm3',
      author_kind: 'agent',
      body_text: 'Answered "Is the raised dot a morpheme break or vowel length?": Morpheme break',
      author: { user_id: 'u-jacob', name: 'Jacob Runner', email: 'jacob@livingtongues.org', is_team: true },
    }),
    current_user_id: 'u1',
  },
}
