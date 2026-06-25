import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/admin/chat/chat-message-item.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 160 }],
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    room_id: 'all-admins',
    author_user_id: 'u-anna',
    body_html: '<p>Did you see the new Yawalapiti entries? Looks great — one typo in the <strong>phonetics</strong>.</p>',
    body_text: 'Did you see the new Yawalapiti entries?',
    client_message_id: null,
    created_at: '2026-06-24T15:30:00.000Z',
    updated_at: '2026-06-24T15:30:00.000Z',
    edited_at: null,
    deleted_at: null,
    attachments: [],
    ...overrides,
  } as never
}

const noop = (() => {}) as never

const file_attachment = { id: 'a1', message_id: 'm1', filename: 'field-notes.pdf', mimetype: 'application/pdf', size_bytes: 248_000, created_at: '2026-06-24T15:30:00.000Z' }

export const FromTeammate: Story<typeof Component> = {
  props: { message: message(), author_name: 'Anna', is_own: false, on_edit: noop, on_delete: noop },
}

export const Mine: Story<typeof Component> = {
  props: { message: message({ author_user_id: 'u-jacob' }), author_name: 'Jacob', is_own: true, on_edit: noop, on_delete: noop },
}

export const PlainTextUrl: Story<typeof Component> = {
  props: { message: message({ body_html: '<p>Repro is at https://livingdictionaries.app/yawalapiti?ref=chat — and the docs say www.example.com too.</p>', body_text: 'Repro is at https://livingdictionaries.app/yawalapiti?ref=chat' }), author_name: 'Anna', is_own: false, on_edit: noop, on_delete: noop },
}

export const Edited: Story<typeof Component> = {
  props: { message: message({ edited_at: '2026-06-24T15:35:00.000Z' }), author_name: 'Anna', is_own: false, on_edit: noop, on_delete: noop },
}

export const Deleted: Story<typeof Component> = {
  props: { message: message({ deleted_at: '2026-06-24T15:40:00.000Z', body_html: '', body_text: '' }), author_name: 'Anna', is_own: false, on_edit: noop, on_delete: noop },
}

export const WithFileAttachment: Story<typeof Component> = {
  props: { message: message({ attachments: [file_attachment] }), author_name: 'Anna', is_own: false, on_edit: noop, on_delete: noop },
}

export const AttachmentOnly: Story<typeof Component> = {
  props: { message: message({ body_html: '', body_text: '', attachments: [file_attachment] }), author_name: 'Greg', is_own: false, on_edit: noop, on_delete: noop },
}
