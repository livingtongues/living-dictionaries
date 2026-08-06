import type { Story, StoryMeta } from 'svelte-look'
import type { AdminImportRow } from '$api/admin/imports/+server'
import type Component from './ImportsTable.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1100, height: 460 }],
}

function row(overrides: Partial<AdminImportRow>): AdminImportRow {
  return {
    thread_id: crypto.randomUUID(),
    dictionary_id: 'demo',
    dictionary_name: 'Demo',
    dictionary_url: 'demo',
    requester_user_id: 'user-1',
    requester_name: 'Ada Lovelace',
    requester_email: 'ada@example.com',
    assigned_to_user_id: 'u-jacob',
    assignee_name: 'Jacob',
    assignee_email: 'jacob@livingtongues.org',
    created_at: '2026-07-20T10:00:00.000Z',
    last_message_at: '2026-07-25T09:00:00.000Z',
    started_at: '2026-07-21T10:00:00.000Z',
    resolved_at: null,
    resource_count: 1,
    open_questions: 0,
    answered_questions: 0,
    artifact_count: 0,
    has_activity_since_resolve: false,
    status: 'in_progress',
    waiting_on: 'team',
    ...overrides,
  }
}

const imports: AdminImportRow[] = [
  row({
    dictionary_name: 'Eastern Pomo',
    dictionary_url: 'eastern-pomo',
    dictionary_id: 'eastern-pomo',
    requester_name: 'jcirelli',
    open_questions: 6,
    artifact_count: 1,
    status: 'waiting_on_manager',
    waiting_on: 'manager',
    last_message_at: '2026-07-25T08:53:34.000Z',
  }),
  row({
    dictionary_name: 'Ponca',
    dictionary_url: 'ponca',
    dictionary_id: 'ponca',
    requester_name: 'Gregory Anderson',
    started_at: null,
    status: 'submitted',
    waiting_on: 'team',
    last_message_at: '2026-07-23T16:30:32.000Z',
  }),
  row({
    dictionary_name: '’Iipay Aa',
    dictionary_url: 'iipay-aa',
    dictionary_id: 'iipay-aa',
    requester_name: 'Vincent',
    requester_user_id: null,
    last_message_at: '2026-07-21T02:57:07.000Z',
  }),
  row({
    dictionary_name: 'Enxet',
    dictionary_url: 'enxet',
    dictionary_id: 'enxet',
    requester_name: 'Gundolf Niebuhr',
    resolved_at: '2026-07-25T00:55:23.000Z',
    answered_questions: 4,
    artifact_count: 1,
    status: 'resolved',
    waiting_on: null,
    last_message_at: '2026-07-24T03:31:36.000Z',
  }),
  row({
    dictionary_name: 'Nahuatl',
    dictionary_url: 'nahuatl',
    dictionary_id: 'nahuatl',
    requester_name: 'Sofía Reyes',
    resolved_at: '2026-06-30T00:00:00.000Z',
    resource_count: 3,
    artifact_count: 2,
    answered_questions: 2,
    status: 'resolved',
    waiting_on: null,
    has_activity_since_resolve: true,
    last_message_at: '2026-07-02T11:00:00.000Z',
  }),
]

const admin_user_id_by_email = new Map([
  ['jwrunner7@gmail.com', 'u-jacob'],
  ['diego@livingtongues.org', 'u-diego'],
  ['livingtongues@gmail.com', 'u-greg'],
  ['ck1105@georgetown.edu', 'u-cailie'],
])

const shared_props = {
  admin_user_id_by_email,
  on_copy_brief: () => {},
  on_assigned: () => {},
}

export const Default: Story<typeof Component> = {
  props: { ...shared_props, imports },
}

/** Nothing resolved yet — no "Past imports" group. */
export const AllOpen: Story<typeof Component> = {
  viewports: [{ width: 1100, height: 260 }],
  props: { ...shared_props, imports: imports.filter(item => !item.resolved_at) },
}

export const AssignedToDiego: Story<typeof Component> = {
  viewports: [{ width: 1100, height: 150 }],
  props: {
    ...shared_props,
    imports: [row({
      dictionary_name: 'Eastern Pomo',
      assigned_to_user_id: 'u-diego',
      assignee_name: 'Diego Córdova',
      assignee_email: 'diego@livingtongues.org',
    })],
  },
}

/** Narrow admin viewport — assignee + updated columns drop out. */
export const Narrow: Story<typeof Component> = {
  viewports: [{ width: 720, height: 460 }],
  props: { ...shared_props, imports },
}
