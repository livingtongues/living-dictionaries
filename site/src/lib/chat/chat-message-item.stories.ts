import type { Story, StoryMeta } from 'svelte-look'
import type Component from '$lib/chat/chat-message-item.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 160 }],
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    room_id: 'notifications',
    author_user_id: 'u-anna',
    body_html: '<p>Did you see the new Yawalapiti entries? Looks great — one typo in the <strong>phonetics</strong>.</p>',
    body_text: 'Did you see the new Yawalapiti entries?',
    client_message_id: null,
    created_at: '2026-06-24T15:30:00.000Z',
    updated_at: '2026-06-24T15:30:00.000Z',
    edited_at: null,
    deleted_at: null,
    reply_to_message_id: null,
    attachments: [],
    reactions: [],
    reply_to: null,
    ...overrides,
  } as never
}

const noop = (() => {}) as never
const base = { me_user_id: 'u-jacob', on_edit: noop, on_delete: noop, on_react: noop, on_reply: noop, on_jump: noop }

const file_attachment = { id: 'a1', message_id: 'm1', filename: 'field-notes.pdf', mimetype: 'application/pdf', size_bytes: 248_000, created_at: '2026-06-24T15:30:00.000Z' }

const reply_text = { message_id: 'm0', author_user_id: 'u-greg', snippet: 'Can you double-check the phonetics on entry #42 before we publish it tonight?', deleted: false, attachment: null }
const reply_deleted = { message_id: 'm0', author_user_id: 'u-diego', snippet: '', deleted: true, attachment: null }
const reply_photo = { message_id: 'm0', author_user_id: 'u-anna', snippet: '', deleted: false, attachment: { is_image: true, filename: 'tree.jpg' } }
const reply_file = { message_id: 'm0', author_user_id: 'u-greg', snippet: '', deleted: false, attachment: { is_image: false, filename: 'field-notes.pdf' } }

export const FromTeammate: Story<typeof Component> = {
  props: { message: message(), author_name: 'Anna', is_own: false, ...base },
}

export const Mine: Story<typeof Component> = {
  props: { message: message({ author_user_id: 'u-jacob' }), author_name: 'Jacob', is_own: true, ...base },
}

export const WithReactions: Story<typeof Component> = {
  props: { message: message({ reactions: [{ emoji: '👍', user_ids: ['u-jacob', 'u-greg'] }, { emoji: '🎉', user_ids: ['u-diego'] }, { emoji: '❤️', user_ids: ['u-anna'] }] }), author_name: 'Anna', is_own: false, ...base },
}

export const PlainTextUrl: Story<typeof Component> = {
  props: { message: message({ body_html: '<p>Repro is at https://livingdictionaries.app/yawalapiti?ref=chat — and the docs say www.example.com too.</p>', body_text: 'Repro is at https://livingdictionaries.app/yawalapiti?ref=chat' }), author_name: 'Anna', is_own: false, ...base },
}

export const Edited: Story<typeof Component> = {
  props: { message: message({ edited_at: '2026-06-24T15:35:00.000Z' }), author_name: 'Anna', is_own: false, ...base },
}

export const Deleted: Story<typeof Component> = {
  props: { message: message({ deleted_at: '2026-06-24T15:40:00.000Z', body_html: '', body_text: '' }), author_name: 'Anna', is_own: false, ...base },
}

export const WithFileAttachment: Story<typeof Component> = {
  props: { message: message({ attachments: [file_attachment] }), author_name: 'Anna', is_own: false, ...base },
}

export const AttachmentOnly: Story<typeof Component> = {
  props: { message: message({ body_html: '', body_text: '', attachments: [file_attachment] }), author_name: 'Greg', is_own: false, ...base },
}

export const ReplyToText: Story<typeof Component> = {
  props: { message: message({ reply_to_message_id: 'm0', reply_to: reply_text, body_html: '<p>Done — fixed the aspiration mark, good catch.</p>', body_text: 'Done — fixed the aspiration mark, good catch.' }), author_name: 'Anna', reply_author_name: 'Greg', is_own: false, ...base },
}

export const ReplyToDeleted: Story<typeof Component> = {
  props: { message: message({ reply_to_message_id: 'm0', reply_to: reply_deleted, body_html: '<p>No worries, I saw it before you removed it.</p>', body_text: 'No worries, I saw it before you removed it.' }), author_name: 'Anna', reply_author_name: 'Diego', is_own: false, ...base },
}

export const ReplyToPhoto: Story<typeof Component> = {
  props: { message: message({ reply_to_message_id: 'm0', reply_to: reply_photo, body_html: '<p>Beautiful shot!</p>', body_text: 'Beautiful shot!' }), author_name: 'Jacob', reply_author_name: 'Anna', is_own: true, ...base },
}

export const ReplyToFile: Story<typeof Component> = {
  props: { message: message({ reply_to_message_id: 'm0', reply_to: reply_file, body_html: '<p>Got the notes, thanks.</p>', body_text: 'Got the notes, thanks.' }), author_name: 'Anna', reply_author_name: 'Greg', is_own: false, ...base },
}
