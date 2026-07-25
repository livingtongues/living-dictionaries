import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ConversationHeader.svelte'
import type { ConversationRow } from '$lib/db/server/import-conversations'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
  viewports: [{ width: 760, height: 180 }, { width: 390, height: 300 }],
}

function conversation(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: 't1',
    dictionary_id: 'demo',
    subject: 'Import request: Nahuatl',
    from_user_id: 'u1',
    from_email: 'manager@example.com',
    from_name: 'Jim Cirelli',
    import_request_note: null,
    started_at: null,
    started_by_user_id: null,
    activity_batch: 0,
    assigned_to_user_id: 'u-jacob',
    resolved_at: null,
    last_message_at: '2026-07-21T02:00:00Z',
    created_at: '2026-07-21T02:00:00Z',
    updated_at: '2026-07-21T02:00:00Z',
    ...overrides,
  }
}

const base = { dictionary_id: 'demo', dictionary_url: 'demo', on_changed: () => {} }

/** The manager, before we start — their one escape hatch is Withdraw. */
export const ManagerBeforeStart: Story<typeof Component> = {
  props: { ...base, conversation: conversation(), is_team: false, can_withdraw: true },
}

/** The manager after we start — locked, and Withdraw is gone. */
export const ManagerLocked: Story<typeof Component> = {
  props: { ...base, conversation: conversation({ started_at: '2026-07-25T04:00:00Z' }), is_team: false, can_withdraw: false },
}

/** Our side before starting: Copy job brief + Start. */
export const TeamNotStarted: Story<typeof Component> = {
  props: { ...base, conversation: conversation(), is_team: true, can_withdraw: false },
}

/** Our side once resolved — Resolve flips to Reopen; the lock never lifts. */
export const TeamResolved: Story<typeof Component> = {
  props: {
    ...base,
    conversation: conversation({ started_at: '2026-07-25T04:00:00Z', resolved_at: '2026-07-25T09:00:00Z' }),
    is_team: true,
    can_withdraw: false,
  },
}
