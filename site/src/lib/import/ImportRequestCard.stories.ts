import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ImportRequestCard.svelte'
import type { ConversationSummary } from '$api/v1/dictionaries/[id]/conversations/+server'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 760, height: 200 }, { width: 390, height: 280 }],
}

function conversation(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: 't1',
    dictionary_id: 'demo',
    subject: 'Import request: Nahuatl',
    from_user_id: 'u1',
    from_email: 'manager@example.com',
    from_name: 'Jim Cirelli',
    import_request_note: 'The handwritten notes in the margins are important; include them where practical.',
    started_at: null,
    started_by_user_id: null,
    activity_batch: 0,
    assigned_to_user_id: 'u-jacob',
    resolved_at: null,
    last_message_at: '2026-07-21T02:00:00Z',
    created_at: '2026-07-21T02:00:00Z',
    updated_at: '2026-07-21T02:00:00Z',
    unread: 0,
    open_questions: 0,
    artifact_count: 0,
    resource_count: 2,
    ...overrides,
  }
}

const base = { dictionary_url: 'demo' }

/** Just requested — we haven't picked it up, so nothing is frozen yet. */
export const AwaitingUs: Story<typeof Component> = {
  props: { ...base, conversation: conversation() },
}

/** We started: the resources are locked and the manager has unread replies. */
export const InProgress: Story<typeof Component> = {
  props: { ...base, conversation: conversation({ started_at: '2026-07-25T04:00:00Z', unread: 2 }) },
}

/** Finished, with six questions still waiting on the manager — the record stays listed forever. */
export const CompletedWithQuestions: Story<typeof Component> = {
  props: {
    ...base,
    conversation: conversation({
      started_at: '2026-07-25T04:00:00Z',
      resolved_at: '2026-07-25T09:00:00Z',
      open_questions: 6,
      artifact_count: 1,
    }),
  },
}
